import { Request, Response } from 'express';
import { prisma } from '../../prisma'; // Usando a instância centralizada

export const getProjects = async (req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    res.status(200).json(projects);
  } catch (error) {
    console.error('[GED Engenharia] Erro ao buscar projetos:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao acessar o banco de dados.' });
  }
};