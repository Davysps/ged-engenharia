import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from 'crypto';
import path from 'path';

const s3 = new S3Client({
  // Adicionado 'as string' para satisfazer o compilador TypeScript
  region: process.env.AWS_REGION as string, 
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  }
});

export const uploadFileToS3 = async (fileBuffer: Buffer, originalName: string, mimeType: string): Promise<{ filePath: string, fileHash: string }> => {
  const fileHash = crypto.randomBytes(16).toString('hex');
  const ext = path.extname(originalName);
  const fileName = `contratos/${fileHash}${ext}`;

  const command = new PutObjectCommand({
    // Adicionado 'as string' aqui também por precaução arquitetural
    Bucket: process.env.AWS_S3_BUCKET as string, 
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3.send(command);

  return {
    filePath: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`,
    fileHash: fileHash
  };
};

// ─────────────────────────────────────────────────────────────────────
// FASE 2 (Nível Enterprise): S3 Pre-signed URLs
// O arquivo deixa de trafegar pela API do Node (multer/memoryStorage) e
// é enviado diretamente pelo Frontend ao bucket S3 via PUT autenticado.
// ─────────────────────────────────────────────────────────────────────

// Constrói a URL pública do objeto a partir da fileKey. Mantém o formato
// canônico que o Worker Python (ged-worker-python) usa para converter a
// filePath de volta em chave S3 no download do PDF.
const buildS3FilePath = (fileKey: string): string =>
  `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;

export interface PresignedUploadResult {
  uploadUrl: string;
  fileKey: string;
  filePath: string;
  fileHash: string;
}

export const generatePresignedUploadUrl = async (
  fileName: string,
  fileType: string
): Promise<PresignedUploadResult> => {
  const fileHash = crypto.randomBytes(16).toString('hex');
  const ext = path.extname(fileName);
  const fileKey = `contratos/${fileHash}${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET as string,
    Key: fileKey,
    ContentType: fileType,
  });

  // Expiração da pre-signed URL (PUT): 15 minutos.
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

  return {
    uploadUrl,
    fileKey,
    filePath: buildS3FilePath(fileKey),
    fileHash,
  };
};

// Reconstrói as referências físicas (filePath e fileHash) a partir da
// fileKey devolvida pelo Frontend na etapa de confirmação do upload.
// O fileHash é o segmento do nome sem extensão (gerado no presign),
// preservando a semântica atual das tipagens Revision.filePath/fileHash.
export const resolveFileReferences = (fileKey: string): { filePath: string; fileHash: string } => {
  const fileHash = path.basename(fileKey, path.extname(fileKey));
  return { filePath: buildS3FilePath(fileKey), fileHash };
};