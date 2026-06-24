import { Request, Response } from 'express';
import { Discipline } from '@prisma/client';
import { prisma } from '../../prisma'; // Usando a instância centralizada

export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, codigoDocumento, titulo, disciplina, createdById } = req.body;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Nenhum ficheiro técnico foi submetido.' });
      return;
    }

    const newDocument = await prisma.document.create({
      data: {
        projectId: Number(projectId),
        codigoDocumento,
        titulo,
        disciplina: disciplina as Discipline,
        createdById: Number(createdById), 
        revisions: {
          create: {
            versionLabel: 'R0', 
            filePath: file.path,
            fileHash: file.filename, 
          }
        }
      },
      include: {
        revisions: true 
      }
    });

    res.status(201).json(newDocument);
  } catch (error) {
    console.error('[GED Engenharia] Erro a processar o upload do documento:', error);
    res.status(500).json({ error: 'Erro interno ao arquivar o ficheiro técnico.' });
  }
};