import { Request, Response } from 'express';
import { Discipline, RevisionStatus, ApprovalStatus } from '@prisma/client';
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
            status: RevisionStatus.EM_REVISAO, // <-- Injeção Estrita do Enum
            approvalWorkflow: {
              create: {
                requesterId: userId,
                status: ApprovalStatus.PENDENTE // <-- Injeção Estrita do Enum
              }
            }
          }
        }
      },
      include: {
        revisions: {
          include: { approvalWorkflow: true }
        } 
      }
    });

    res.status(201).json(newDocument);
  } catch (error) {
    console.error('[GED Engenharia] Erro a processar o upload do documento:', error);
    res.status(500).json({ error: 'Erro interno ao arquivar o ficheiro técnico.' });
  }
};

export const uploadRevision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const documentId = Number(req.params.id);
    const file = req.file;
    const userId = req.userId;

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

    const { filePath, fileHash } = await uploadFileToS3(file.buffer, file.originalname, file.mimetype);

    const newRevision = await prisma.$transaction(async (tx) => {
      
      await tx.revision.updateMany({
        where: { documentId, status: { not: RevisionStatus.OBSOLETO } }, // <-- Injeção Estrita
        data: { status: RevisionStatus.OBSOLETO }
      });

      return await tx.revision.create({
        data: {
          documentId,
          versionLabel: nextVersionLabel,
          filePath: filePath,
          fileHash: fileHash, 
          status: RevisionStatus.EM_REVISAO, // <-- Injeção Estrita
          approvalWorkflow: {
            create: {
              requesterId: userId,
              status: ApprovalStatus.PENDENTE // <-- Injeção Estrita
            }
          }
        },
        include: {
          approvalWorkflow: true
        }
      });
    });

    res.status(201).json(newRevision);
  } catch (error) {
    console.error('[GED Engenharia] Erro ao processar a nova revisão:', error);
    res.status(500).json({ error: 'Erro interno ao registrar a revisão técnica.' });
  }
};