-- CreateEnum
CREATE TYPE "TransmittalStatus" AS ENUM ('EM_PROCESSAMENTO', 'CONCLUIDO', 'ERRO');

-- CreateTable
CREATE TABLE "Transmittal" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "mensagem" TEXT,
    "status" "TransmittalStatus" NOT NULL DEFAULT 'EM_PROCESSAMENTO',
    "zipUrl" TEXT,
    "pdfCapaUrl" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transmittal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransmittalItem" (
    "id" SERIAL NOT NULL,
    "transmittalId" INTEGER NOT NULL,
    "revisionId" INTEGER NOT NULL,

    CONSTRAINT "TransmittalItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transmittal_status_idx" ON "Transmittal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Transmittal_contractId_codigo_key" ON "Transmittal"("contractId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "TransmittalItem_transmittalId_revisionId_key" ON "TransmittalItem"("transmittalId", "revisionId");

-- AddForeignKey
ALTER TABLE "Transmittal" ADD CONSTRAINT "Transmittal_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transmittal" ADD CONSTRAINT "Transmittal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransmittalItem" ADD CONSTRAINT "TransmittalItem_transmittalId_fkey" FOREIGN KEY ("transmittalId") REFERENCES "Transmittal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransmittalItem" ADD CONSTRAINT "TransmittalItem_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
