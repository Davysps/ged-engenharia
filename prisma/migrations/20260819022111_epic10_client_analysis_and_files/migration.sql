-- CreateEnum
CREATE TYPE "ApprovalStage" AS ENUM ('VERIFICACAO', 'APROVACAO', 'CLIENTE');

-- DropIndex
DROP INDEX "ApprovalWorkflow_revisionId_key";

-- AlterTable
ALTER TABLE "ApprovalWorkflow" ADD COLUMN     "commentedFileUrl" TEXT,
ADD COLUMN     "stage" "ApprovalStage" NOT NULL DEFAULT 'VERIFICACAO';

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_revisionId_idx" ON "ApprovalWorkflow"("revisionId");
