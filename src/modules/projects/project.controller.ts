import { Response } from 'express';
import { prisma } from '../../prisma';
import { AuthRequest } from '../../middlewares/auth.middleware'; // Traz o Request com o userId

export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. O userId foi injetado pelo nosso verifyToken (É o ID do Carlos)
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    // 2. Busca APENAS os contratos onde este usuário está vinculado (Memberships)
    const contratos = await prisma.contract.findMany({
      where: {
        memberships: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        client: true, // Traz os dados do Cliente (Ex: Vale S.A.)
        memberships: {
          where: { userId: userId },
          select: { role: true } // Mostra qual é a permissão dele neste contrato (GESTOR, LEITOR...)
        }
      }
    });
    
    res.status(200).json(contratos);
  } catch (error) {
    console.error('[GED Engenharia] Erro ao buscar contratos:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao acessar os contratos.' });
  }
};