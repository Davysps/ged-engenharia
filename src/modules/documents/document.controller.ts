import type { Request, Response } from 'express';
import { Discipline, RevisionStatus, ApprovalStatus, DocumentOcrStatus } from '@prisma/client';
import { prisma } from '../../prisma';
import { uploadFileToS3 } from '../../services/s3.service';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { sendToOcrQueue } from '../../services/sqs.service';

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
            status: RevisionStatus.EM_REVISAO, 
            approvalWorkflow: {
              create: {
                requesterId: userId,
                status: ApprovalStatus.PENDENTE 
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

    // INJEÇÃO ÉPICO 5: Disparo de evento assíncrono SQS para OCR
    try {
      const firstRevision = newDocument.revisions[0];
      if (firstRevision) {
        await sendToOcrQueue(newDocument.id, firstRevision.id, firstRevision.filePath);
      }
    } catch (sqsError) {
      console.error('[GED-OCR] Erro ao enviar documento R0 para a fila SQS:', sqsError);
    }

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
        where: { documentId, status: { not: RevisionStatus.OBSOLETO } }, 
        data: { status: RevisionStatus.OBSOLETO }
      });

      // Atualiza o documento pai indicando que o OCR para a nova revisão está pendente
      await tx.document.update({
        where: { id: documentId },
        data: { ocrStatus: DocumentOcrStatus.PENDING }
      });

      return await tx.revision.create({
        data: {
          documentId,
          versionLabel: nextVersionLabel,
          filePath: filePath,
          fileHash: fileHash, 
          status: RevisionStatus.EM_REVISAO, 
          approvalWorkflow: {
            create: {
              requesterId: userId,
              status: ApprovalStatus.PENDENTE 
            }
          }
        },
        include: {
          approvalWorkflow: true
        }
      });
    });

    // INJEÇÃO ÉPICO 5: Disparo de evento assíncrono SQS para OCR na nova revisão
    try {
      await sendToOcrQueue(documentId, newRevision.id, newRevision.filePath);
    } catch (sqsError) {
      console.error('[GED-OCR] Erro ao enviar nova revisão para a fila SQS:', sqsError);
    }

    res.status(201).json(newRevision);
  } catch (error) {
    console.error('[GED Engenharia] Erro ao processar a nova revisão:', error);
    res.status(500).json({ error: 'Erro interno ao registrar a revisão técnica.' });
  }
};

// NOVO ÉPICO 5: Webhook Recebedor do AWS Textract (Python RPA)
export const updateMetadataWebhook = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { ocrStatus, metadata } = req.body;

  // Proteção rigorosa do Serviço Interno
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.GED_INTERNAL_SECRET) {
    res.status(401).json({ error: 'Acesso não autorizado para o serviço interno.' });
    return;
  }

  try {
    const updatedDocument = await prisma.document.update({
      where: { id: Number(id) },
      data: {
        ocrStatus: ocrStatus as DocumentOcrStatus,
        projectNumber: metadata?.projectNumber,
        extractedRevision: metadata?.revision,
        discipline: metadata?.discipline,
        extractedMetadata: metadata?.rawTextractPayload,
      },
    });

    res.status(200).json(updatedDocument);
  } catch (error) {
    console.error(`[GED-API] Falha ao atualizar metadados via Webhook (Doc ID: ${id}):`, error);
    res.status(500).json({ error: 'Erro interno ao atualizar os metadados do OCR.' });
  }
};