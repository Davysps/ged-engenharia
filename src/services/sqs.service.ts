import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

// Instância do cliente SQS apontando para a região correta
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });

export const sendToOcrQueue = async (documentId: number, revisionId: number, filePath: string): Promise<void> => {
  if (!process.env.AWS_SQS_OCR_QUEUE_URL) {
    console.warn('[GED-OCR] AVISO: AWS_SQS_OCR_QUEUE_URL não está definida no .env.');
    return;
  }

  const command = new SendMessageCommand({
    QueueUrl: process.env.AWS_SQS_OCR_QUEUE_URL,
    // Payload enviado para a fila: o Python precisará do filePath para ler do S3
    MessageBody: JSON.stringify({ documentId, revisionId, filePath }),
  });

  await sqsClient.send(command);
};