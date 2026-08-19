import { Response } from 'express';
import { prisma } from '../../prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { ApprovalStatus, RevisionStatus } from '@prisma/client';
import { approvalActionSchema } from './approval.schemas';

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

    // A QUERY CORRIGIDA PARA O NEON DB: Exige o enum ApprovalStatus.PENDENTE em vez de string
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

    const formattedPending = pending.map(p => ({
      id: p.id,
      codigoDocumento: p.revision.document.codigoDocumento,
      revisao: p.revision.versionLabel,
      disciplina: p.revision.document.contractDiscipline?.nome ?? 'Não definida',
      solicitante: p.requester?.nome || 'Sistema',
      dataSolicitacao: p.requestedAt.toISOString()
    }));

    res.status(200).json(formattedPending);
  } catch (error: any) {
    console.error('[ApprovalController GET] Erro FATAL:', error?.message || error);
    res.status(500).json({ error: `Erro no Servidor: ${error?.message}` });
  }
};

export const handleApprovalAction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    
    const approvalId = parseInt(req.params.id as string, 10);
    if (isNaN(approvalId)) {
      res.status(400).json({ error: 'ID de aprovação inválido.' });
      return;
    }

    // ÉPICO 10: Validação Zod — exige um dos status exatos do fluxo estrito
    const parsed = approvalActionSchema.parse(req.body);
    const { status, comments } = parsed;

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
    const actionRevision =
      status === ApprovalStatus.REPROVADO ? RevisionStatus.REJEITADO : RevisionStatus.APROVADO;

    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { id: approvalId },
      include: { revision: { include: { document: true } } }
    });

    if (!workflow) {
      res.status(404).json({ error: 'Fluxo de aprovação não encontrado.' });
      return;
    }

    if (workflow.status !== ApprovalStatus.PENDENTE) {
      res.status(400).json({ error: 'Esta revisão já foi processada anteriormente.' });
      return;
    }

    const contractId = workflow.revision.document.contractId;

    const membership = await prisma.contractMembership.findUnique({
      where: { userId_contractId: { userId, contractId } }
    });

    if (!membership || !['GESTOR', 'APROVADOR'].includes(membership.role)) {
      res.status(403).json({ error: 'Acesso negado: Perfil insuficiente para realizar aprovações.' });
      return;
    }

    // ÉPICO 10: Identificação de ator — membros externos (Cliente) marcados com isClient
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { isClient: true }
    });
    const isClient = actor?.isClient ?? false;

    // A CORREÇÃO: Sintaxe Relacional (Checked Input) permite a transação aninhada perfeita!
    await prisma.approvalWorkflow.update({
      where: { id: approvalId },
      data: {
        status: actionWorkflow,
        reviewer: { connect: { id: userId } }, // <-- O SEGREDO ESTÁ AQUI
        reviewedAt: new Date(),
        comments: actionComments,
        isClient: isClient,
        revision: {
          update: {
            status: actionRevision
          }
        }
      }
    });

    res.status(200).json({ message: `Documento processado como ${status} com sucesso.` });
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