import type { Request, Response } from 'express';
import { RevisionStatus, ApprovalStatus, ApprovalStage, DocumentOcrStatus } from '@prisma/client';
import { prisma } from '../../prisma';
import { generatePresignedUploadUrl, resolveFileReferences, uploadFileToS3 } from '../../services/s3.service';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { sendToOcrQueue } from '../../services/sqs.service';
import { DocumentService } from './document.service';
import {
  uploadDocumentSchema,
  presignedUrlSchema,
  documentListQuerySchema,
} from './document.schemas';
import { AuditService } from '../audit/audit.service';

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = uploadDocumentSchema.parse(req.body);
    const { contractId, codigoDocumento, titulo, fileKey } = parsed;
    const userId = req.userId;

    // ÉPICO 7.5: Vínculos opcionais de Planejamento e Disciplina do Contrato
    // Prisma (exactOptionalPropertyTypes) exige null — e não undefined — para FKs opcionais não preenchidas
    const workPackageId = parsed.workPackageId ?? null;
    const contractDisciplineId = parsed.contractDisciplineId ?? null;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    if (!fileKey) {
      res.status(400).json({ error: 'Nenhum ficheiro técnico foi submetido.' });
      return;
    }

    // Etapa 2.6 — RBAC: apenas GESTOR/COORDENADOR criam novos documentos.
    // O ENGENHEIRO não cria documento (apenas visualiza, aponta horas e decide
    // tecnicamente); o PLANEJADOR foca em Planejamento e não cria acervo técnico.
    const membership = await prisma.contractMembership.findUnique({
      where: { userId_contractId: { userId, contractId } },
      select: { role: true },
    });
    if (!membership || !['GESTOR', 'COORDENADOR'].includes(membership.role)) {
      res.status(403).json({
        error: 'Acesso negado: apenas Gestores ou Coordenadores podem criar novos documentos.',
      });
      return;
    }

    // FASE 2 (Nível Enterprise): o arquivo já está no S3 (PUT direto via
    // pre-signed URL). O Backend apenas regista a fileKey como referência.
    const { filePath, fileHash } = resolveFileReferences(fileKey);

    const newDocument = await prisma.document.create({
      data: {
        contractId,
        codigoDocumento,
        titulo,
        workPackageId,
        contractDisciplineId,
        createdById: userId,
        revisions: {
          create: {
            versionLabel: 'R0', 
            filePath: filePath, 
            fileHash: fileHash, 
            status: RevisionStatus.EM_REVISAO, 
            approvalWorkflows: {
              create: {
                requesterId: userId,
                status: ApprovalStatus.PENDENTE,
                stage: ApprovalStage.VERIFICACAO 
              }
            }
          }
        }
      },
      include: {
        revisions: {
          include: { approvalWorkflows: true }
        } 
      }
    });

    // INJEÇÃO ÉPICO 5: Disparo de evento assíncrono SQS para OCR
    try {
      const firstRevision = newDocument.revisions[0];
      if (firstRevision) {
        await sendToOcrQueue(newDocument.id, firstRevision.id, firstRevision.filePath);
      }
    } catch (sqsError) {
      console.error('[GED-OCR] Erro ao enviar documento R0 para a fila SQS:', sqsError);
    }

    // ÉPICO 12: Trilha de Auditoria — Upload de novo documento
    AuditService.log({
      userId,
      contractId,
      action: 'UPLOAD_DOCUMENT',
      entity: 'Document',
      entityId: newDocument.id,
      details: {
        codigoDocumento,
        titulo,
        revisionLabel: 'R0',
        fileHash: newDocument.revisions[0]?.fileHash,
      },
      ipAddress: req.ip ?? null,
    });

    res.status(201).json(newDocument);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      res.status(400).json({ error: error.issues?.map((i: any) => i.message).join('; ') || 'Payload inválido.' });
      return;
    }
    console.error('[GED Engenharia] Erro a processar o upload do documento:', error);
    res.status(500).json({ error: 'Erro interno ao arquivar o ficheiro técnico.' });
  }
};

// ── FASE 2 (Nível Enterprise): S3 PRE-SIGNED URL ─────────────────────
// POST /documents/presigned-url
// O Frontend informa nome e MIME type do arquivo; o Backend gera uma URL
// PUT autenticada no bucket S3 (expiração de 15 min) e a fileKey que o
// Frontend deverá enviar de volta na etapa de confirmação do upload.
export const createPresignedUrl = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const parsed = presignedUrlSchema.parse(req.body);
    const result = await generatePresignedUploadUrl(parsed.fileName, parsed.fileType);

    res.status(200).json(result);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      res.status(400).json({ error: error.issues?.map((i: any) => i.message).join('; ') || 'Payload inválido.' });
      return;
    }
    console.error('[GED Engenharia] Erro ao gerar pre-signed URL do upload:', error);
    res.status(500).json({ error: 'Erro interno ao gerar a URL de upload.' });
  }
};

export const uploadRevision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const documentId = Number(req.params.id);
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    if (isNaN(documentId)) {
      res.status(400).json({ error: 'ID do documento inválido.' });
      return;
    }

    // FASE 2 (Nível Enterprise): o body carrega a fileKey (JSON, não mais
    // multipart via multer) — o arquivo já foi enviado direto ao S3.
    const fileKey = (req.body?.fileKey ?? '').trim();
    if (!fileKey) {
      res.status(400).json({ error: 'Nenhum arquivo físico foi submetido.' });
      return;
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        revisions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            approvalWorkflows: {
              orderBy: { requestedAt: 'asc' },
            },
          },
        }
      }
    });

    if (!document) {
      res.status(404).json({ error: 'Documento não encontrado.' });
      return;
    }

    // Etapa 2.6 — RBAC: apenas GESTOR/COORDENADOR sobem novas revisões oficiais.
    const membership = await prisma.contractMembership.findUnique({
      where: { userId_contractId: { userId, contractId: document.contractId } },
      select: { role: true },
    });
    if (!membership || !['GESTOR', 'COORDENADOR'].includes(membership.role)) {
      res.status(403).json({
        error: 'Acesso negado: apenas Gestores ou Coordenadores podem submeter novas revisões.',
      });
      return;
    }

    // ── PATCH 10.3: GATEKEEPER DE NOVA REVISÃO OFICIAL ───────────────────
    // PREMISSA MÁXIMA: "Retrabalho Interno" ≠ "Revisão Oficial (Cliente)".
    // Uma nova revisão (R1, R2...) SÓ nasce quando o ciclo de Análise do
    // Cliente foi concluído (APROVADO, APROVADO_C/ COMENTARIOS ou REPROVADO),
    // ou em dados legados sem carimbos (retrocompatibilidade).
    // Reprovações internas (Verificação/Coordenação) NÃO desbloqueiam R+1:
    // o retrabalho usa a rota /internal-update mantendo a mesma revisão.
    const lastRevision = document.revisions[0];

    if (lastRevision) {
      const approvals = lastRevision.approvalWorkflows ?? [];
      const hasOpenPending = approvals.some(
        (approval) => approval.status === ApprovalStatus.PENDENTE
      );

      const clientApprovals = approvals.filter((a) => a.stage === ApprovalStage.CLIENTE);
      const clientCycleDone =
        clientApprovals.length > 0 &&
        clientApprovals.every((a) => a.status !== ApprovalStatus.PENDENTE);

      const legacyWithoutApprovals =
        approvals.length === 0 && lastRevision.status === RevisionStatus.APROVADO;

      const canCreateNewRevision = !hasOpenPending && (clientCycleDone || legacyWithoutApprovals);

      if (!canCreateNewRevision) {
        res.status(403).json({
          error:
            `GATEKEEPER: A revisão ${lastRevision.versionLabel} não concluiu a Análise do Cliente. ` +
            'Uma nova revisão oficial (R+1) só pode nascer após a resposta do Cliente. ' +
            'Se o retorno foi interno (Verificação/Coordenação), use a Correção Interna para manter a revisão atual.',
        });
        return;
      }
    }

    let nextVersionNumber = 0;

    if (lastRevision) {
      const match = lastRevision.versionLabel.match(/R(\d+)/i);
      
      if (match && match[1]) {
        nextVersionNumber = parseInt(match[1], 10) + 1;
      } else {
        nextVersionNumber = document.revisions.length;
      }
    }
    
    const nextVersionLabel = `R${nextVersionNumber}`;

    const { filePath, fileHash } = resolveFileReferences(fileKey);

    const newRevision = await prisma.$transaction(async (tx) => {
      
      await tx.revision.updateMany({
        where: { documentId, status: { not: RevisionStatus.OBSOLETO } }, 
        data: { status: RevisionStatus.OBSOLETO }
      });

      // Atualiza o documento pai indicando que o OCR para a nova revisão está pendente
      await tx.document.update({
        where: { id: documentId },
        data: { ocrStatus: DocumentOcrStatus.PENDING }
      });

      return await tx.revision.create({
        data: {
          documentId,
          versionLabel: nextVersionLabel,
          filePath: filePath,
          fileHash: fileHash, 
          status: RevisionStatus.EM_REVISAO, 
          approvalWorkflows: {
            create: {
              requesterId: userId,
              status: ApprovalStatus.PENDENTE,
              stage: ApprovalStage.VERIFICACAO
            }
          }
        },
        include: {
          approvalWorkflows: true
        }
      });
    });

    // INJEÇÃO ÉPICO 5: Disparo de evento assíncrono SQS para OCR na nova revisão
    try {
      await sendToOcrQueue(documentId, newRevision.id, newRevision.filePath);
    } catch (sqsError) {
      console.error('[GED-OCR] Erro ao enviar nova revisão para a fila SQS:', sqsError);
    }

    // ÉPICO 12: Trilha de Auditoria — Nova revisão oficial
    AuditService.log({
      userId,
      contractId: document.contractId,
      action: 'UPLOAD_REVISION',
      entity: 'Revision',
      entityId: newRevision.id,
      details: {
        documentId,
        versionLabel: nextVersionLabel,
        fileHash: newRevision.fileHash,
      },
      ipAddress: req.ip ?? null,
    });

    res.status(201).json(newRevision);
  } catch (error) {
    console.error('[GED Engenharia] Erro ao processar a nova revisão:', error);
    res.status(500).json({ error: 'Erro interno ao registrar a revisão técnica.' });
  }
};

// ── PATCH 10.3: RETRABALHO INTERNO (Correção sem gerar Revisão Oficial) ─────
// POST /documents/:id/revisions/:revId/internal-update (multipart/form-data)
//
// PREMISSA MÁXIMA: "Retrabalho Interno" ≠ "Revisão Oficial".
// Quando o Verificador Interno ou a Coordenação devolvem a revisão
// (REPROVADO / APROVADO_COM_COMENTARIOS), o autor corrige o PDF DENTRO da
// mesma revisão (R0 permanece R0): o filePath/fileHash são substituídos e um
// NOVO carimbo ApprovalWorkflow (stage VERIFICACAO, status PENDENTE) reinicia
// o ciclo interno. Nenhuma nova revisão é criada no banco.
export const internalUpdateRevision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const documentId = Number(req.params.id);
    const revisionId = Number(req.params.revId);
    const file = req.file;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    if (isNaN(documentId) || isNaN(revisionId)) {
      res.status(400).json({ error: 'ID do documento ou da revisão inválido.' });
      return;
    }

    if (!file) {
      res.status(400).json({ error: 'Nenhum arquivo corrigido foi submetido.' });
      return;
    }

    const revision = await prisma.revision.findUnique({
      where: { id: revisionId },
      include: {
        document: { select: { id: true, contractId: true } },
        approvalWorkflows: { orderBy: { requestedAt: 'asc' } },
      },
    });

    if (!revision || revision.documentId !== documentId) {
      res.status(404).json({ error: 'Revisão não encontrada para este documento.' });
      return;
    }

    // ── RBAC multi-tenant (Etapa 2.6): apenas o Time interno
    // (GESTOR/COORDENADOR/ENGENHEIRO) do contrato corrige; usuários Cliente
    // (isClient) jamais reenviam internamente.
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { isClient: true },
    });

    const membership = await prisma.contractMembership.findUnique({
      where: { userId_contractId: { userId, contractId: revision.document.contractId } },
    });

    if (
      actor?.isClient ||
      !membership ||
      !['GESTOR', 'COORDENADOR', 'ENGENHEIRO'].includes(membership.role)
    ) {
      res.status(403).json({
        error: 'Acesso negado: apenas o Time interno (Engenharia/Coordenação) pode enviar correções internas.',
      });
      return;
    }

    // ── GATEKEEPER DE RETRABALHO INTERNO (PATCH 10.3) ────────────────────
    // A correção interna só é válida quando o último carimbo é um retorno do
    // fluxo interno (Verificação ou Coordenação com REPROVADO/COM COMENTÁRIOS).
    // Isso impede burlar a Análise do Cliente via esta rota.
    const approvals = revision.approvalWorkflows ?? [];

    const hasOpenPending = approvals.some(
      (approval) => approval.status === ApprovalStatus.PENDENTE
    );
    if (hasOpenPending) {
      res.status(409).json({
        error:
          'Existe uma análise pendente para esta revisão. Aguarde a conclusão do carimbo antes de enviar nova correção.',
      });
      return;
    }

    const latestStamp =
      approvals.length > 0 ? approvals[approvals.length - 1] : undefined;

    const isInternalRework =
      !!latestStamp &&
      (latestStamp.stage === ApprovalStage.VERIFICACAO ||
        latestStamp.stage === ApprovalStage.APROVACAO) &&
      (latestStamp.status === ApprovalStatus.REPROVADO ||
        latestStamp.status === ApprovalStatus.APROVADO_COM_COMENTARIOS);

    if (!isInternalRework) {
      res.status(403).json({
        error:
          'GATEKEEPER: A Correção Interna só é permitida quando o fluxo interno (Verificação/Coordenação) ' +
          'devolveu a revisão. Retornos da Análise do Cliente exigem uma Nova Revisão Oficial.',
      });
      return;
    }

    // Substitui o físico da MESMA revisão (sem criar R+1)
    const { filePath, fileHash } = await uploadFileToS3(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    const updatedRevision = await prisma.$transaction(async (tx) => {
      // 1. Atualiza o arquivo e devolve a revisão ao ciclo (EM_REVISAO)
      const updated = await tx.revision.update({
        where: { id: revisionId },
        data: {
          filePath,
          fileHash,
          status: RevisionStatus.EM_REVISAO,
        },
        include: {
          approvalWorkflows: { orderBy: { requestedAt: 'asc' } },
        },
      });

      // 2. NOVO carimbo — reinicia o ciclo interno na mesma revisão.
      //    O histórico anterior é preservado (nunca sobrescrito).
      await tx.approvalWorkflow.create({
        data: {
          revisionId,
          requesterId: userId,
          stage: ApprovalStage.VERIFICACAO,
          status: ApprovalStatus.PENDENTE,
        },
      });

      // 3. Novo físico → OCR precisa reprocessar esta revisão
      await tx.document.update({
        where: { id: documentId },
        data: { ocrStatus: DocumentOcrStatus.PENDING },
      });

      return updated;
    });

    // INJEÇÃO ÉPICO 5: Disparo assíncrono SQS para OCR do arquivo corrigido
    try {
      await sendToOcrQueue(documentId, revisionId, filePath);
    } catch (sqsError) {
      console.error('[GED-OCR] Erro ao enviar correção interna para a fila SQS:', sqsError);
    }

    // ÉPICO 12: Trilha de Auditoria — Correção interna de revisão
    AuditService.log({
      userId,
      contractId: revision.document.contractId,
      action: 'INTERNAL_UPDATE_REVISION',
      entity: 'Revision',
      entityId: revisionId,
      details: {
        documentId,
        versionLabel: updatedRevision.versionLabel,
        fileHash,
      },
      ipAddress: req.ip ?? null,
    });

    res.status(200).json({
      message: `Correção interna registrada em ${updatedRevision.versionLabel}. O ciclo de Verificação foi reiniciado.`,
      revision: updatedRevision,
    });
  } catch (error) {
    console.error('[GED Engenharia] Erro ao processar a correção interna:', error);
    res.status(500).json({ error: 'Erro interno ao registrar a correção interna.' });
  }
};

// ÉPICO 13: Webhook Recebedor do Worker Python (OCR Local / PyMuPDF).
// Recebe o texto extraído do PDF e grava na Revision, além de atualizar o
// status de OCR do documento. Retroativo ao ÉPICO 5 (AWS Textract) quando o
// payload antigo `{ ocrStatus, metadata }` continua sendo aceito.
export const updateMetadataWebhook = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const body = req.body ?? {};

  // Proteção rigorosa do Serviço Interno
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.GED_INTERNAL_SECRET) {
    res.status(401).json({ error: 'Acesso não autorizado para o serviço interno.' });
    return;
  }

  // ── NOVO FORMATO (ÉPICO 13): { documentId, revisionId, status, extractedText } ──
  const hasRevisionPayload = typeof body.revisionId === 'number' && !!body.status;

  if (hasRevisionPayload) {
    try {
      const revisionId = Number(body.revisionId);
      const documentId = Number(body.documentId ?? id);
      const status = body.status === 'FAILED' ? DocumentOcrStatus.FAILED : DocumentOcrStatus.COMPLETED;

      const updated = await prisma.$transaction(async (tx) => {
        // 1. Grava o texto extraído na revisão correspondente
        const revision = await tx.revision.update({
          where: { id: revisionId },
          data: { extractedText: body.extractedText ?? null },
          select: { id: true, documentId: true },
        });

        // 2. Atualiza o status de OCR do documento (mantém o Document como fonte
        //    para a exibição do badge de OCR no detalhamento)
        const updatedDocument = await tx.document.update({
          where: { id: Number(documentId) },
          data: { ocrStatus: status as DocumentOcrStatus },
        });

        return { revision, updatedDocument };
      });

      res.status(200).json(updated);
    } catch (error) {
      console.error(`[GED-API] Falha ao gravar texto extraído via Webhook (Doc ID: ${id}):`, error);
      res.status(500).json({ error: 'Erro interno ao gravar o texto extraído do OCR.' });
    }
    return;
  }

  // ── FORMATO LEGADO (ÉPICO 5): { ocrStatus, metadata } ──
  const { ocrStatus, metadata } = body;
  try {
    const updatedDocument = await prisma.document.update({
      where: { id: Number(id) },
      data: {
        ocrStatus: ocrStatus as DocumentOcrStatus,
        projectNumber: metadata?.projectNumber,
        extractedRevision: metadata?.revision,
        extractedMetadata: metadata?.rawTextractPayload,
      },
    });

    res.status(200).json(updatedDocument);
  } catch (error) {
    console.error(`[GED-API] Falha ao atualizar metadados via Webhook (Doc ID: ${id}):`, error);
    res.status(500).json({ error: 'Erro interno ao atualizar os metadados do OCR.' });
  }
};

// ── PATCH 10.4: ISOLAMENTO DO PORTAL DO CLIENTE ─────────────────────────
// Helper central: identifica se o requisitante é um ator externo (Cliente).
// O JWT carrega apenas o userId; o flag isClient é lido da fonte de verdade
// (tabela User) a cada requisição para evitar privilégios em tokens antigos.
const getActorIsClient = async (userId: number): Promise<boolean> => {
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { isClient: true },
  });
  return actor?.isClient ?? false;
};

// ÉPICO 8: Listagem de documentos do contrato com Busca Avançada (filtros combináveis)
export const listDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const contractId = Number(req.params.id);

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    if (isNaN(contractId)) {
      res.status(400).json({ error: 'ID do contrato inválido.' });
      return;
    }

    // Validação Zod dos query params de busca avançada (busca, disciplinaId, pacoteId)
    const filters = documentListQuerySchema.parse(req.query);

    // PATCH 10.4: Cliente só lista documentos que chegaram ao estágio CLIENTE.
    const isClient = await getActorIsClient(userId);

    // Delega a query + verificação de RBAC (multi-tenant) para o service
    const documents = await DocumentService.listDocuments(contractId, userId, filters, { isClient });

    res.status(200).json(documents);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      res.status(400).json({ error: error.issues?.map((i: any) => i.message).join('; ') || 'Query params inválidos.' });
      return;
    }
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado a este contrato.' });
      return;
    }
    console.error('[GED Engenharia] Erro ao listar documentos:', error);
    res.status(500).json({ error: 'Erro interno ao listar os documentos.' });
  }
};

// ── ÉPICO 11: EXPORTAÇÃO DE MDR (Master Document Register) ─────────────
// GET /documents/export/mdr?contractId=X
// Retorna um arquivo .xlsx com todos os metadados consolidados do contrato.
export const exportMDR = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const contractId = Number(req.query.contractId);

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    if (isNaN(contractId)) {
      res.status(400).json({ error: 'O parâmetro contractId é obrigatório e deve ser um número válido.' });
      return;
    }

    const buffer = await DocumentService.exportMDR(contractId, userId);

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { codigo: true },
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `MDR_${contract?.codigo ?? contractId}_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (error: any) {
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado a este contrato.' });
      return;
    }
    console.error('[GED Engenharia] Erro ao exportar MDR:', error);
    res.status(500).json({ error: 'Erro interno ao gerar a exportação do MDR.' });
  }
};

// ÉPICO 8: Detalhamento de Documento (Single Source of Truth)
export const getDocumentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const documentId = Number(req.params.id);

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    if (isNaN(documentId)) {
      res.status(400).json({ error: 'ID do documento inválido.' });
      return;
    }

    // PATCH 10.4: Cliente não acessa documentos que não chegaram ao estágio
    // CLIENTE (o service devolve null → 403 abaixo, sem vazamento de existência)
    // e recebe apenas os carimbos visíveis (estágio CLIENTE, sem "roupa suja").
    const isClient = await getActorIsClient(userId);

    // Delega a query complexa + verificação de RBAC (multi-tenant) para o service
    const document = await DocumentService.findDocumentById(documentId, userId, { isClient });

    if (!document) {
      // Retorna 403 para não vazar a existência do documento a usuários não autorizados
      // (inclui o caso PATCH 10.4: documento ainda preso no ciclo interno)
      res.status(403).json({ error: 'Acesso negado ou documento não encontrado.' });
      return;
    }

    res.status(200).json(document);
  } catch (error) {
    console.error('[GED Engenharia] Erro ao buscar detalhes do documento:', error);
    res.status(500).json({ error: 'Erro interno ao buscar os detalhes do documento.' });
  }
};
