/*
  Warnings:

  - You are about to drop the column `projectId` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `AuditTrail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[contractId,codigo_documento]` on the table `Document` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `contractId` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('SYSADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ContractRole" AS ENUM ('GESTOR', 'ENGENHEIRO', 'APROVADOR', 'LEITOR');

-- AlterEnum
ALTER TYPE "Discipline" ADD VALUE 'ARQUITETURA';

-- AlterEnum
ALTER TYPE "RevisionStatus" ADD VALUE 'REJEITADO';

-- DropForeignKey
ALTER TABLE "AuditTrail" DROP CONSTRAINT "AuditTrail_performedById_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Revision" DROP CONSTRAINT "Revision_documentId_fkey";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "projectId",
ADD COLUMN     "contractId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Revision" ADD COLUMN     "comments" JSONB;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "globalRole" "GlobalRole" NOT NULL DEFAULT 'USER';

-- DropTable
DROP TABLE "AuditTrail";

-- DropTable
DROP TABLE "Project";

-- DropEnum
DROP TYPE "AuditAction";

-- DropEnum
DROP TYPE "AuditEntityType";

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractMembership" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "role" "ContractRole" NOT NULL DEFAULT 'LEITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_cnpj_key" ON "Client"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_codigo_key" ON "Contract"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ContractMembership_userId_contractId_key" ON "ContractMembership"("userId", "contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_contractId_codigo_documento_key" ON "Document"("contractId", "codigo_documento");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractMembership" ADD CONSTRAINT "ContractMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractMembership" ADD CONSTRAINT "ContractMembership_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
