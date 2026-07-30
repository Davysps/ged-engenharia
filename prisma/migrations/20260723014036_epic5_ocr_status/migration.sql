-- CreateEnum
CREATE TYPE "DocumentOcrStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "extractedMetadata" JSONB,
ADD COLUMN     "extractedRevision" TEXT,
ADD COLUMN     "ocrStatus" "DocumentOcrStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "projectNumber" TEXT;
