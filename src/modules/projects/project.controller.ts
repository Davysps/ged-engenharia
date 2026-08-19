import { Response } from 'express';
import { prisma } from '../../prisma';
import type { ContractMembership } from '@prisma/client';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { listDocuments } from '../documents/document.controller';

/**
 * Estruturas da Árvore Hierárquica (ÉPICO 9):
 * Clientes > Projetos > Contratos.
 */

interface ContractTreeNode {
  id: number;
  codigo: string;
  nome: string;
  descricao: string | null;
  role: string | null;
}

interface ProjectTreeNode {
  id: number | null;
  nome: string;
  contracts: ContractTreeNode[];
}

interface ClientTreeNode {
  id: number;
  nome: string;
  cnpj: string | null;
  projects: ProjectTreeNode[];
}

type MembershipWithHierarchy = ContractMembership & {
  contract: {
    id: number;
    codigo: string;
    nome: string;
    descricao: string | null;
    clientId: number;
    projectId: number | null;
    client: { id: number; nome: string; cnpj: string | null };
    project: { id: number; nome: string } | null;
  };
};

/**
 * Monta a árvore Cliente > Projeto > Contrato a partir das memberships do
 * usuário logado. Contratos legados (sem `projectId`) são agrupados sob um
 * projeto virtual "Sem Projeto", preservando a retrocompatibilidade.
 */
function buildHierarchyTree(memberships: MembershipWithHierarchy[]): ClientTreeNode[] {
  const clientsMap = new Map<
    number,
    ClientTreeNode & { projectsMap: Map<string, ProjectTreeNode> }
  >();

  for (const membership of memberships) {
    const contract = membership.contract;
    const client = contract.client;

    let clientNode = clientsMap.get(client.id);
    if (!clientNode) {
      clientNode = {
        id: client.id,
        nome: client.nome,
        cnpj: client.cnpj,
        projects: [],
        projectsMap: new Map(),
      };
      clientsMap.set(client.id, clientNode);
    }

    const projectKey = contract.projectId ? String(contract.projectId) : 'legacy';
    let projectNode = clientNode.projectsMap.get(projectKey);
    if (!projectNode) {
      projectNode = {
        id: contract.project?.id ?? null,
        nome: contract.project?.nome ?? 'Sem Projeto',
        contracts: [],
      };
      clientNode.projectsMap.set(projectKey, projectNode);
    }

    projectNode.contracts.push({
      id: contract.id,
      codigo: contract.codigo,
      nome: contract.nome,
      descricao: contract.descricao,
      role: membership.role,
    });
  }

  return Array.from(clientsMap.values()).map((clientNode) => ({
    id: clientNode.id,
    nome: clientNode.nome,
    cnpj: clientNode.cnpj,
    projects: Array.from(clientNode.projectsMap.values()),
  }));
}

export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    // ISOLAMENTO MULTI-TENANT: apenas contratos onde o usuário é membro
    const memberships = await prisma.contractMembership.findMany({
      where: { userId },
      include: {
        contract: {
          include: {
            client: true,
            project: true,
          },
        },
      },
      orderBy: { contract: { nome: 'asc' } },
    });

    // Árvore hierárquica completa: Clientes > Projetos > Contratos
    res.status(200).json(buildHierarchyTree(memberships as MembershipWithHierarchy[]));
  } catch (error) {
    console.error('[GED Engenharia] Erro ao buscar a hierarquia de contratos:', error);
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