-- AlterTable
ALTER TABLE "Transmittal" ADD COLUMN     "destinatario" VARCHAR(100),
ADD COLUMN     "proposito" TEXT NOT NULL DEFAULT 'PARA_CONHECIMENTO';
