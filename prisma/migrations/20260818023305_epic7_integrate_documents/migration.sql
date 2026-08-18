-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "contractDisciplineId" INTEGER,
ADD COLUMN     "workPackageId" INTEGER;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contractDisciplineId_fkey" FOREIGN KEY ("contractDisciplineId") REFERENCES "ContractDiscipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
