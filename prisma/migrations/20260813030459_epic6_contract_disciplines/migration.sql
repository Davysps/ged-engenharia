-- CreateTable
CREATE TABLE "ContractDiscipline" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractDiscipline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractDiscipline_contractId_idx" ON "ContractDiscipline"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractDiscipline_contractId_codigo_key" ON "ContractDiscipline"("contractId", "codigo");

-- AddForeignKey
ALTER TABLE "ContractDiscipline" ADD CONSTRAINT "ContractDiscipline_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
