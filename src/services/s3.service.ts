import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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