/*
  Warnings:

  - You are about to drop the column `approvedAt` on the `Revision` table. All the data in the column will be lost.
  - You are about to drop the column `approvedById` on the `Revision` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- DropForeignKey
ALTER TABLE "Revision" DROP CONSTRAINT "Revision_approvedById_fkey";

-- AlterTable
ALTER TABLE "Revision" DROP COLUMN "approvedAt",
DROP COLUMN "approvedById";

-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" SERIAL NOT NULL,
    "revisionId" INTEGER NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "reviewerId" INTEGER,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDENTE',
    "comments" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflow_revisionId_key" ON "ApprovalWorkflow"("revisionId");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_status_idx" ON "ApprovalWorkflow"("status");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_requesterId_idx" ON "ApprovalWorkflow"("requesterId");

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
