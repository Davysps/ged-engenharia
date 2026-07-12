import { Response } from 'express';
import { prisma } from '../../prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { ApprovalStatus, RevisionStatus } from '@prisma/client';

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
          include: { document: true }
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
      disciplina: p.revision.document.disciplina,
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
    
    const isApprove = req.originalUrl.includes('/approve');
    
    const actionWorkflow = isApprove ? ApprovalStatus.APROVADO : ApprovalStatus.REJEITADO;
    const actionRevision = isApprove ? RevisionStatus.APROVADO : RevisionStatus.REJEITADO;
    
    const comments = (req.body && req.body.comments) ? String(req.body.comments) : null;

    if (actionWorkflow === ApprovalStatus.REJEITADO && !comments) {
      res.status(400).json({ error: 'Justificativa técnica é obrigatória ao rejeitar.' });
      return;
    }

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

    // A CORREÇÃO: Sintaxe Relacional (Checked Input) permite a transação aninhada perfeita!
    await prisma.approvalWorkflow.update({
      where: { id: approvalId },
      data: {
        status: actionWorkflow,
        reviewer: { connect: { id: userId } }, // <-- O SEGREDO ESTÁ AQUI
        reviewedAt: new Date(),
        comments: comments,
        revision: {
          update: {
            status: actionRevision
          }
        }
      }
    });

    res.status(200).json({ message: `Documento processado como ${actionWorkflow.toLowerCase()} com sucesso.` });
  } catch (error: any) {
    console.error(`[ApprovalController POST] Erro FATAL:`, error);
    const errorMessage = error?.message || 'Falha catastrófica desconhecida no servidor.';
    res.status(500).json({ error: `Erro no Servidor: ${errorMessage}` });
  }
};