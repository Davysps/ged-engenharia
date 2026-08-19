import { Request, Response, RequestHandler } from 'express';
import { prisma } from '../../prisma';
import { createTransmittalSchema } from './transmittal.schemas';

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

      // ÉPICO 10.1: Validação rigorosa do payload via Zod (substitui a sanitização manual)
      const parsed = createTransmittalSchema.parse(req.body);
      const { assunto, mensagem, destinatario, proposito, revisionIds: validRevisionIds } = parsed;

      const membership = await prisma.contractMembership.findFirst({
        where: { userId: userId, contractId: contractId }
      });

      if (!membership || !['GESTOR', 'ENGENHEIRO'].includes(membership.role)) {
        res.status(403).json({ error: 'Permissão negada. Apenas Gestores ou Engenheiros podem emitir Transmittals.' });
        return;
      }

      // ── GATEKEEPER DE GRD (ÉPICO 10.1) ──────────────────────────────────
      // Trava de segurança crítica: toda revisão do lote DEVE estar com o
      // status de aprovação final "APROVADO". Documento PENDENTE ou REPROVADO
      // bloqueia a emissão da Guia de Remessa com erro 400 (Bad Request).
      const batchRevisions = await prisma.revision.findMany({
        where: {
          id: { in: validRevisionIds },
          document: { contractId: contractId }
        },
        select: {
          id: true,
          status: true,
          versionLabel: true,
          document: { select: { codigoDocumento: true } }
        }
      });

      const foundIds = new Set(batchRevisions.map(r => r.id));
      const unknownIds = validRevisionIds.filter(id => !foundIds.has(id));
      if (unknownIds.length > 0) {
        res.status(400).json({
          error: 'GATEKEEPER GRD: Um ou mais documentos do lote não pertencem a este contrato ou não existem.'
        });
        return;
      }

      const blocked = batchRevisions.filter(r => r.status !== 'APROVADO');
      if (blocked.length > 0) {
        const blockedDesc = blocked
          .map(r => `${r.document.codigoDocumento} (${r.versionLabel}) — ${r.status}`)
          .join('; ');
        res.status(400).json({
          error:
            'GATEKEEPER GRD: Todos os documentos do lote devem estar com o status final "APROVADO" ' +
            'para emissão da Guia de Remessa. Bloqueado(s): ' +
            blockedDesc +
            '.'
        });
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
              // Injeta apenas os IDs limpos e validados pelo Zod
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

    } catch (error: any) {
      if (error?.name === 'ZodError') {
        res.status(400).json({ error: error.issues?.map((i: any) => i.message).join('; ') || 'Payload inválido.' });
        return;
      }
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
        include: {
          document: { include: { contractDiscipline: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formatted = approvedRevisions.map(rev => ({
        id: rev.id,
        codigoDocumento: rev.document.codigoDocumento,
        titulo: rev.document.titulo,
        versionLabel: rev.versionLabel,
        disciplina: rev.document.contractDiscipline?.nome ?? 'Não definida',
        // ÉPICO 10.1: expõe o status para o frontend filtrar apenas APROVADO
        status: rev.status
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