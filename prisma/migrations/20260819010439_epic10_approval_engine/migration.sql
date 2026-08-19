/*
  Warnings:

  - The values [REJEITADO] on the enum `ApprovalStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ApprovalStatus_new" AS ENUM ('PENDENTE', 'APROVADO', 'APROVADO_COM_COMENTARIOS', 'REPROVADO');
ALTER TABLE "public"."ApprovalWorkflow" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ApprovalWorkflow" ALTER COLUMN "status" TYPE "ApprovalStatus_new" USING ("status"::text::"ApprovalStatus_new");
ALTER TYPE "ApprovalStatus" RENAME TO "ApprovalStatus_old";
ALTER TYPE "ApprovalStatus_new" RENAME TO "ApprovalStatus";
DROP TYPE "public"."ApprovalStatus_old";
ALTER TABLE "ApprovalWorkflow" ALTER COLUMN "status" SET DEFAULT 'PENDENTE';
COMMIT;

-- AlterTable
ALTER TABLE "ApprovalWorkflow" ADD COLUMN     "isClient" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isClient" BOOLEAN NOT NULL DEFAULT false;
