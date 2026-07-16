import { Request, Response, RequestHandler } from 'express';
import { prisma } from '../../prisma';

export class TransmittalController {
  
  public create: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const contractId = Number(req.params.contractId);
      const extractedId = (req as any).userId || (req as any).user?.id;
      const userId = Number(extractedId);

      if (!userId) {
        res.status(401).json({ error: 'Utilizador não autenticado no contexto da requisição.' });
        return;
      }

      const { assunto, mensagem, destinatario, proposito, revisionIds } = req.body;

      // SANEAMENTO RIGOROSO: Garante que extraímos apenas números válidos do array
      const validRevisionIds = Array.isArray(revisionIds) 
        ? revisionIds.filter(id => id !== null && id !== undefined && !isNaN(Number(id))).map(Number)
        : [];

      if (!assunto || !proposito) {
        res.status(400).json({ error: 'Os campos Assunto e Propósito são obrigatórios.' });
        return;
      }

      if (validRevisionIds.length === 0) {
        res.status(400).json({ error: 'Pelo menos um documento válido deve ser selecionado para gerar a GRD.' });
        return;
      }

      const membership = await prisma.contractMembership.findFirst({
        where: { userId: userId, contractId: contractId }
      });

      if (!membership || !['GESTOR', 'ENGENHEIRO'].includes(membership.role)) {
        res.status(403).json({ error: 'Permissão negada. Apenas Gestores ou Engenheiros podem emitir Transmittals.' });
        return;
      }

      const transmittal = await prisma.$transaction(async (tx) => {
        const transmittalCount = await tx.transmittal.count({ where: { contractId } });
        const codigo = `TR-${String(transmittalCount + 1).padStart(4, '0')}`;

        return await tx.transmittal.create({
          data: {
            contractId,
            codigo,
            assunto,
            mensagem: mensagem ?? null,
            destinatario: destinatario ?? null,
            proposito,
            createdById: userId,
            status: 'EM_PROCESSAMENTO',
            items: {
              // Injeta apenas os IDs limpos e validados
              create: validRevisionIds.map(id => ({ revisionId: id }))
            }
          },
          include: { items: true }
        });
      });

      res.status(202).json({
        message: 'GRD registada com sucesso e enviada para processamento.',
        transmittal
      });

    } catch (error) {
      console.error('[TransmittalController] Erro na criação:', error);
      res.status(500).json({ error: 'Erro interno ao gerar a Guia de Remessa.' });
    }
  };

  public list: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const contractId = Number(req.params.contractId);
      const extractedId = (req as any).userId || (req as any).user?.id;
      const userId = Number(extractedId);

      const transmittals = await prisma.transmittal.findMany({
        where: { contractId },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, nome: true } },
          _count: { select: { items: true } }
        }
      });

      res.status(200).json(transmittals);
    } catch (error) {
      console.error('[TransmittalController] Erro na listagem:', error);
      res.status(500).json({ error: 'Erro interno.' });
    }
  };

  public getApprovedRevisions: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const contractId = Number(req.params.contractId);
      
      const approvedRevisions = await prisma.revision.findMany({
        where: {
          document: { contractId: contractId },
          status: 'APROVADO'
        },
        include: { document: true },
        orderBy: { createdAt: 'desc' }
      });

      const formatted = approvedRevisions.map(rev => ({
        id: rev.id,
        codigoDocumento: rev.document.codigoDocumento,
        titulo: rev.document.titulo,
        versionLabel: rev.versionLabel,
        disciplina: rev.document.disciplina
      }));

      const uniqueDocs = new Map();
      for (const item of formatted) {
        if (!uniqueDocs.has(item.codigoDocumento)) {
          uniqueDocs.set(item.codigoDocumento, item);
        }
      }

      res.status(200).json(Array.from(uniqueDocs.values()));
    } catch (error) {
      console.error('[TransmittalController] Erro ao buscar aprovações:', error);
      res.status(500).json({ error: 'Erro ao buscar revisões.' });
    }
  };

  public webhookComplete: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const transmittalId = Number(req.params.transmittalId);
      const { zipUrl, pdfCapaUrl, errorMsg } = req.body;

      if (errorMsg) {
        await prisma.transmittal.update({ where: { id: transmittalId }, data: { status: 'ERRO' } });
        res.status(200).json({ message: 'Erro registado.' });
        return;
      }

      await prisma.transmittal.update({
        where: { id: transmittalId },
        data: { status: 'CONCLUIDO', zipUrl, pdfCapaUrl }
      });

      res.status(200).json({ message: 'Sucesso.' });
    } catch (error) {
      res.status(500).json({ error: 'Erro no Webhook.' });
    }
  };
}