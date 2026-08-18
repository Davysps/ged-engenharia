import { Response } from 'express';
import { prisma } from '../../prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { listDocuments } from '../documents/document.controller';

export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const contratos = await prisma.contract.findMany({
      where: {
        memberships: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        client: true,
        memberships: {
          where: { userId: userId },
          select: { role: true }
        }
      }
    });
    
    res.status(200).json(contratos);
  } catch (error) {
    console.error('[GED Engenharia] Erro ao buscar contratos:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao acessar os contratos.' });
  }
};

export const getProjectById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const projectId = parseInt(req.params.id as string, 10);

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    if (isNaN(projectId)) {
      res.status(400).json({ error: 'ID do projeto inválido.' });
      return;
    }

    const project = await prisma.contract.findFirst({
      where: {
        id: projectId,
        memberships: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        client: true, 
        memberships: {
          where: { userId: userId }, 
          select: { role: true }
        }
      }
    });

    if (!project) {
      res.status(403).json({ error: 'Acesso negado ou projeto não encontrado.' });
      return;
    }

    res.status(200).json(project);
  } catch (error) {
    console.error('[GED Engenharia] Erro ao buscar projeto:', error);
    res.status(500).json({ error: 'Erro interno ao buscar projeto' });
  }
};

// Delegado ao DocumentService (ÉPICO 8): listagem com Busca Avançada e RBAC multi-tenant
export const getProjectDocuments = listDocuments;