import type { Request, Response } from 'express';
import { RevisionStatus, ApprovalStatus, ApprovalStage, DocumentOcrStatus } from '@prisma/client';
import { prisma } from '../../prisma';
import { uploadFileToS3 } from '../../services/s3.service';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { sendToOcrQueue } from '../../services/sqs.service';
import { DocumentService } from './document.service';
import { uploadDocumentSchema, documentListQuerySchema } from './document.schemas';

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = uploadDocumentSchema.parse(req.body);
    const { contractId, codigoDocumento, titulo } = parsed;
    const file = req.file;
    const userId = req.userId;

    // ÉPICO 7.5: Vínculos opcionais de Planejamento e Disciplina do Contrato
    // Prisma (exactOptionalPropertyTypes) exige null — e não undefined — para FKs opcionais não preenchidas
    const workPackageId = parsed.workPackageId ?? null;
    const contractDisciplineId = parsed.contractDisciplineId ?? null;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    if (!file) {
      res.status(400).json({ error: 'Nenhum ficheiro técnico foi submetido.' });
      return;
    }

    const { filePath, fileHash } = await uploadFileToS3(file.buffer, file.originalname, file.mimetype);

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

export const uploadRevision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const documentId = Number(req.params.id);
    const file = req.file;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    if (isNaN(documentId)) {
      res.status(400).json({ error: 'ID do documento inválido.' });
      return;
    }

    if (!file) {
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

    // ── ÉPICO 10 / PATCH 10.2: GATEKEEPER DE NOVA REVISÃO ────────────────
    // Uma nova revisão (R1, R2...) SÓ é desbloqueada quando:
    //   (a) o ciclo de "Análise do Cliente" já foi concluído, OU
    //   (b) o fluxo interno/cliente reprovou e exige uma nova versão oficial, OU
    //   (c) dados legados sem carimbos (retrocompatibilidade).
    // Qualquer carimbo ainda PENDENTE bloqueia a subida.
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

      const needsNewOfficialVersion = lastRevision.status === RevisionStatus.REJEITADO;
      const legacyWithoutApprovals =
        approvals.length === 0 && lastRevision.status === RevisionStatus.APROVADO;

      const canCreateNewRevision =
        !hasOpenPending && (clientCycleDone || needsNewOfficialVersion || legacyWithoutApprovals);

      if (!canCreateNewRevision) {
        res.status(403).json({
          error:
            `GATEKEEPER: A revisão anterior (${lastRevision.versionLabel}) ainda não concluiu o fluxo. ` +
            'A nova revisão só é desbloqueada após o ciclo de Análise do Cliente ser concluído ' +
            'ou quando o fluxo reprova e exige uma nova versão oficial.',
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

    const { filePath, fileHash } = await uploadFileToS3(file.buffer, file.originalname, file.mimetype);

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

    res.status(201).json(newRevision);
  } catch (error) {
    console.error('[GED Engenharia] Erro ao processar a nova revisão:', error);
    res.status(500).json({ error: 'Erro interno ao registrar a revisão técnica.' });
  }
};

// NOVO ÉPICO 5: Webhook Recebedor do AWS Textract (Python RPA)
export const updateMetadataWebhook = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { ocrStatus, metadata } = req.body;

  // Proteção rigorosa do Serviço Interno
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.GED_INTERNAL_SECRET) {
    res.status(401).json({ error: 'Acesso não autorizado para o serviço interno.' });
    return;
  }

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

    // Delega a query + verificação de RBAC (multi-tenant) para o service
    const documents = await DocumentService.listDocuments(contractId, userId, filters);

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

    // Delega a query complexa + verificação de RBAC (multi-tenant) para o service
    const document = await DocumentService.findDocumentById(documentId, userId);

    if (!document) {
      // Retorna 403 para não vazar a existência do documento a usuários não autorizados
      res.status(403).json({ error: 'Acesso negado ou documento não encontrado.' });
      return;
    }

    res.status(200).json(document);
  } catch (error) {
    console.error('[GED Engenharia] Erro ao buscar detalhes do documento:', error);
    res.status(500).json({ error: 'Erro interno ao buscar os detalhes do documento.' });
  }
};
