import { Request, Response } from 'express';
import { Discipline } from '@prisma/client';
import { prisma } from '../../prisma';
import { uploadFileToS3 } from '../../services/s3.service';
import { AuthRequest } from '../../middlewares/auth.middleware';

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Removemos o createdById daqui. O frontend não dita mais quem é o autor.
    const { contractId, codigoDocumento, titulo, disciplina } = req.body;
    const file = req.file;
    
    // 2. Pegamos o ID real extraído pelo nosso middleware de segurança
    const userId = req.userId; 

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    if (!file) {
      res.status(400).json({ error: 'Nenhum ficheiro técnico foi submetido.' });
      return;
    }

    // 3. Envia o Buffer da memória direto para o AWS S3
    const { filePath, fileHash } = await uploadFileToS3(file.buffer, file.originalname, file.mimetype);

    // 4. Salva no banco de dados com a URL da AWS e o ID blindado do usuário
    const newDocument = await prisma.document.create({
      data: {
        contractId: Number(contractId),
        codigoDocumento,
        titulo,
        disciplina: disciplina as Discipline,
        createdById: userId, // <-- Seguro, extraído do Token
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

export const uploadRevision = async (req: Request, res: Response): Promise<void> => {
  try {
    const documentId = Number(req.params.id);
    const file = req.file;

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
    const lastRevision = document.revisions[0]; // O TS avalia como (Revision | undefined)

    if (lastRevision) {
      const lastLabel = lastRevision.versionLabel; // Agora é seguro, lastRevision existe
      const match = lastLabel.match(/R(\d+)/i); // Captura o número após o "R"
      
      if (match && match[1]) {
        nextVersionNumber = parseInt(match[1], 10) + 1;
      } else {
        nextVersionNumber = document.revisions.length;
      }
    }
    
    const nextVersionLabel = `R${nextVersionNumber}`;

    // 3. Executa a criação e atualização atonicamente via transação
    const newRevision = await prisma.$transaction(async (tx) => {
      
      // Passa as versões antigas que não estejam obsoletas para OBSOLETO
      await tx.revision.updateMany({
        where: { documentId, status: { not: 'OBSOLETO' } },
        data: { status: 'OBSOLETO' }
      });

      // Cria o registro da nova revisão
      return await tx.revision.create({
        data: {
          documentId,
          versionLabel: nextVersionLabel,
          filePath: file.path,
          fileHash: file.filename, 
          status: 'EM_ELABORACAO'
        }
      });
    });

    res.status(201).json(newRevision);
  } catch (error) {
    console.error('[GED Engenharia] Erro ao processar a nova revisão:', error);
    res.status(500).json({ error: 'Erro interno ao registrar a revisão técnica.' });
  }
};