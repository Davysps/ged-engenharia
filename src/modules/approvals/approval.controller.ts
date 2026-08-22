import { Response } from 'express';
import { prisma } from '../../prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { ApprovalStatus, ApprovalStage, RevisionStatus } from '@prisma/client';
import { approvalActionSchema } from './approval.schemas';
import { uploadFileToS3 } from '../../services/s3.service';

const STAGE_LABEL: Record<ApprovalStage, string> = {
  VERIFICACAO: 'Verificação (Time Interno)',
  APROVACAO: 'Aprovação (Coordenação)',
  CLIENTE: 'Análise do Cliente',
};

export const getPendingApprovals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const contractId = parseInt(req.query.contractId as string, 10);
    if (isNaN(contractId)) {
      res.status(400).json({ error: 'O contractId fornecido na requisição é inválido.' });
      return;
    }

    const membership = await prisma.contractMembership.findUnique({
      where: {
        userId_contractId: { userId, contractId }
      }
    });

    if (!membership) {
      res.status(403).json({ error: 'Acesso negado a este contrato.' });
      return;
    }

    const pending = await prisma.approvalWorkflow.findMany({
      where: {
        status: ApprovalStatus.PENDENTE,
        revision: {
          document: {
            contractId: contractId
          }
        }
      },
      include: {
        revision: {
          include: {
            document: {
              include: { contractDiscipline: true }
            }
          }
        },
        requester: {
          select: { nome: true }
        }
      },
      orderBy: { requestedAt: 'desc' }
    });

    // PATCH 10.2: Expõe o estágio do carimbo (Verificação/Aprovação/Cliente)
    const formattedPending = pending.map(p => ({
      id: p.id,
      codigoDocumento: p.revision.document.codigoDocumento,
      revisao: p.revision.versionLabel,
      disciplina: p.revision.document.contractDiscipline?.nome ?? 'Não definida',
      solicitante: p.requester?.nome || 'Sistema',
      dataSolicitacao: p.requestedAt.toISOString(),
      stage: p.stage,
      stageLabel: STAGE_LABEL[p.stage],
      isClient: p.isClient
    }));

    res.status(200).json(formattedPending);
  } catch (error: any) {
    console.error('[ApprovalController GET] Erro FATAL:', error?.message || error);
    res.status(500).json({ error: `Erro no Servidor: ${error?.message}` });
  }
};

/**
 * PATCH 10.2 — MÁQUINA DE ESTADOS DE ENGENHARIA
 *
 * Cada carimbo do fluxo é um registro ApprovalWorkflow independente (histórico
 * preservado, nunca sobrescrito). A transição depende do estágio (stage) do
 * carimbo que está sendo decidido:
 *
 * ┌───────────────┬───────────────────────────────┬──────────────────────────────┐
 * │ Estágio       │ APROVADO (limpo)              │ APROVADO_C/ COMENT. / REPROV │
 * ├───────────────┼───────────────────────────────┼──────────────────────────────┤
 * │ VERIFICACAO   │ Avança p/ Aprovação (Coord.)  │ Revisão Verificação (retorno)│
 * │ APROVACAO     │ APROVADO — documento trava    │ Revisão Aprovação (retorno)  │
 * │ CLIENTE       │ APROVADO final                │ Nova versão oficial exigida  │
 * └───────────────┴───────────────────────────────┴──────────────────────────────┘
 */
export const handleApprovalAction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const approvalId = parseInt(req.params.id as string, 10);
    if (isNaN(approvalId)) {
      res.status(400).json({ error: 'ID de aprovação inválido.' });
      return;
    }

    // PATCH 10.2: Payload via multipart/form-data (multer preenche req.body)
    const parsed = approvalActionSchema.parse({
      status: req.body.status,
      comments: req.body.comments,
    });
    const { status, comments } = parsed;

    // ── Upload opcional do PDF comentado ──────────────────────────────────
    // Só é permitido anexar arquivo nos carimbos que exigem retorno ao autor:
    // APROVADO_COM_COMENTARIOS ou REPROVADO.
    let commentedFileUrl: string | null = null;
    if (req.file) {
      if (status !== ApprovalStatus.APROVADO_COM_COMENTARIOS && status !== ApprovalStatus.REPROVADO) {
        res.status(400).json({
          error: 'O anexo de arquivo comentado só é permitido ao aprovar com comentários ou reprovar.',
        });
        return;
      }
      const { filePath } = await uploadFileToS3(req.file.buffer, req.file.originalname, req.file.mimetype);
      commentedFileUrl = filePath;
    }

    // Regras do motor estrito: comentário é obrigatório ao aprovar com comentários ou reprovar
    let actionComments: string | null = null;
    if (status === ApprovalStatus.APROVADO_COM_COMENTARIOS || status === ApprovalStatus.REPROVADO) {
      if (!comments || !comments.trim()) {
        res.status(400).json({
          error:
            status === ApprovalStatus.REPROVADO
              ? 'Justificativa técnica é obrigatória ao reprovar.'
              : 'O comentário é obrigatório ao aprovar com comentários.',
        });
        return;
      }
      actionComments = comments.trim();
    }

    const actionWorkflow = status as ApprovalStatus;

    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { id: approvalId },
      include: {
        revision: {
          include: {
            document: true,
            approvalWorkflows: { orderBy: { requestedAt: 'asc' } }
          }
        }
      }
    });

    if (!workflow) {
      res.status(404).json({ error: 'Fluxo de aprovação não encontrado.' });
      return;
    }

    if (workflow.status !== ApprovalStatus.PENDENTE) {
      res.status(400).json({ error: 'Este carimbo já foi processado anteriormente.' });
      return;
    }

    const contractId = workflow.revision.document.contractId;

    // ÉPICO 10: Identificação de ator — membros externos (Cliente) marcados com isClient
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { isClient: true }
    });
    const isClient = actor?.isClient ?? false;

    const membership = await prisma.contractMembership.findUnique({
      where: { userId_contractId: { userId, contractId } }
    });

    // ── GATEKEEPER POR ESTÁGIO (PATCH 10.2) ──────────────────────────────
    // Análise do Cliente: SOMENTE o ator externo (isClient: true) responde.
    // Carimbos internos (Verificação/Coordenação): somente GESTOR/APROVADOR do Time.
    const stage = workflow.stage;

    if (stage === ApprovalStage.CLIENTE) {
      // Isolamento multi-tenant: o Cliente precisa ser membro do contrato do documento
      if (!isClient) {
        res.status(403).json({
          error: 'Acesso negado: apenas o Cliente pode responder à Análise pós-emissão.',
        });
        return;
      }
      if (!membership) {
        res.status(403).json({ error: 'Acesso negado: você não é membro deste contrato.' });
        return;
      }
    } else {
      if (!membership || !['GESTOR', 'APROVADOR'].includes(membership.role) || isClient) {
        res.status(403).json({
          error: 'Acesso negado: Perfil insuficiente para realizar esta aprovação interna.',
        });
        return;
      }
    }

    // ── TRANSIÇÃO DE ESTADO DA MÁQUINA ────────────────────────────────────
    // Define o novo status da revisão e se um próximo carimbo deve ser criado
    // (nunca sobrescreve o carimbo atual: cada transição cria um registro novo).
    let nextRevisionStatus: RevisionStatus = workflow.revision.status;
    let nextStage: ApprovalStage | null = null;

    if (stage === ApprovalStage.VERIFICACAO) {
      if (status === ApprovalStatus.APROVADO) {
        // Verificação limpa → avança para o Carimbo 2 (Coordenação)
        nextRevisionStatus = RevisionStatus.EM_REVISAO;
        nextStage = ApprovalStage.APROVACAO;
      } else {
        // Retorno ao autor → Revisão Verificação
        nextRevisionStatus = RevisionStatus.REJEITADO;
      }
    } else if (stage === ApprovalStage.APROVACAO) {
      if (status === ApprovalStatus.APROVADO) {
        // Coordenação aprovou limpo → documento trava, aguardando GRD
        nextRevisionStatus = RevisionStatus.APROVADO;
      } else {
        // Retorno ao autor → Revisão Aprovação
        nextRevisionStatus = RevisionStatus.REJEITADO;
      }
    } else {
      // CLIENTE — avaliação final pós-emissão
      if (status === ApprovalStatus.APROVADO) {
        nextRevisionStatus = RevisionStatus.APROVADO;
      } else {
        // Aprovado com comentários ou reprovado → exige nova versão oficial
        nextRevisionStatus = RevisionStatus.REJEITADO;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.approvalWorkflow.update({
        where: { id: approvalId },
        data: {
          status: actionWorkflow,
          reviewer: { connect: { id: userId } },
          reviewedAt: new Date(),
          comments: actionComments,
          commentedFileUrl: commentedFileUrl,
          isClient: isClient,
        }
      });

      await tx.revision.update({
        where: { id: workflow.revisionId },
        data: { status: nextRevisionStatus }
      });

      // Gera o próximo carimbo PENDENTE (novo registro — histórico preservado)
      if (nextStage) {
        await tx.approvalWorkflow.create({
          data: {
            revisionId: workflow.revisionId,
            requesterId: workflow.requesterId,
            stage: nextStage,
            status: ApprovalStatus.PENDENTE,
          }
        });
      }
    });

    res.status(200).json({
      message: `Documento processado como ${status} com sucesso.`,
      stage: stage,
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      res.status(400).json({ error: error.issues?.map((i: any) => i.message).join('; ') || 'Payload inválido.' });
      return;
    }
    console.error(`[ApprovalController POST] Erro FATAL:`, error);
    const errorMessage = error?.message || 'Falha catastrófica desconhecida no servidor.';
    res.status(500).json({ error: `Erro no Servidor: ${errorMessage}` });
  }
};