import { Request, Response } from 'express';
import { Discipline } from '@prisma/client';
import { prisma } from '../../prisma';
import { uploadFileToS3 } from '../../services/s3.service';
import { AuthRequest } from '../../middlewares/auth.middleware';

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { contractId, codigoDocumento, titulo, disciplina } = req.body;
    const file = req.file;
    const userId = req.userId; 

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    if (!file) {
      res.status(400).json({ error: 'Nenhum ficheiro técnico foi submetido.' });
      return;
    }

    const { filePath, fileHash } = await uploadFileToS3(file.buffer, file.originalname, file.mimetype);

    const newDocument = await prisma.document.create({
      data: {
        contractId: Number(contractId),
        codigoDocumento,
        titulo,
        disciplina: disciplina as Discipline,
        createdById: userId,
        revisions: {
          create: {
            versionLabel: 'R0', 
            filePath: filePath, 
            fileHash: fileHash, 
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

// REFATORADO PARA O ÉPICO 2: Conectado à AWS S3 e tipado com AuthRequest
export const uploadRevision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const documentId = Number(req.params.id);
    const file = req.file;
    const userId = req.userId; // Proteção de rota extraída do JWT

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    if (isNaN(documentId)) {
      res.status(400).json({ error: 'ID do documento inválido.' });
      return;
    }

    if (!file) {
      res.status(400).json({ error: 'Nenhum arquivo físico foi submetido.' });
      return;
    }

    // 1. Busca a última revisão para definir a próxima etiqueta (R1, R2...)
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        revisions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      }
    });

    if (!document) {
      res.status(404).json({ error: 'Documento não encontrado.' });
      return;
    }

    // 2. Extrai o número da última revisão e incrementa
    let nextVersionNumber = 0;
    const lastRevision = document.revisions[0];

    if (lastRevision) {
      const match = lastRevision.versionLabel.match(/R(\d+)/i);
      
      if (match && match[1]) {
        nextVersionNumber = parseInt(match[1], 10) + 1;
      } else {
        nextVersionNumber = document.revisions.length;
      }
    }
    
    const nextVersionLabel = `R${nextVersionNumber}`;

    // 3. FAZ O UPLOAD DO NOVO ARQUIVO DIRETAMENTE PARA A AWS S3
    const { filePath, fileHash } = await uploadFileToS3(file.buffer, file.originalname, file.mimetype);

    // 4. Executa a criação e atualização atomicamente via transação
    const newRevision = await prisma.$transaction(async (tx) => {
      
      // Passa as versões antigas que não estejam obsoletas para OBSOLETO
      await tx.revision.updateMany({
        where: { documentId, status: { not: 'OBSOLETO' } },
        data: { status: 'OBSOLETO' }
      });

      // Cria o registro da nova revisão com a URL da AWS
      return await tx.revision.create({
        data: {
          documentId,
          versionLabel: nextVersionLabel,
          filePath: filePath, // URL pública da S3
          fileHash: fileHash, // Hash seguro
          status: 'EM_ELABORACAO' // Nasce aguardando aprovação
        }
      });
    });

    res.status(201).json(newRevision);
  } catch (error) {
    console.error('[GED Engenharia] Erro ao processar a nova revisão:', error);
    res.status(500).json({ error: 'Erro interno ao registrar a revisão técnica.' });
  }
};