import { prisma } from '../src/prisma';

async function main() {
  console.log('Iniciando o seed da base de dados Multi-Tenant...');

  // 1. Limpar banco para evitar duplicidades em testes
  await prisma.revision.deleteMany();
  await prisma.document.deleteMany();
  await prisma.contractMembership.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  // 2. Criar Cliente e Contrato
  const client = await prisma.client.create({
    data: { nome: 'Vale S.A.', cnpj: '33.592.510/0001-54' }
  });

  const contract = await prisma.contract.create({
    data: {
      clientId: client.id,
      codigo: 'VALE-2026-ENG',
      nome: 'Expansão Mina Norte',
      descricao: 'Projeto de engenharia civil e estrutural para ampliação da planta.'
    }
  });

  // 3. Criar Usuários (O Gestor e o Engenheiro)
  const gestor = await prisma.user.create({
    data: { nome: 'Carlos Coordenador', email: 'carlos@ged.com', senhaHash: 'hash', globalRole: 'USER' }
  });

  const engenheiro = await prisma.user.create({
    data: { nome: 'Davy Silva', email: 'davy@ged.com', senhaHash: 'hash', globalRole: 'USER' }
  });

  // 4. Distribuir as Permissões no Contrato (RBAC)
  await prisma.contractMembership.createMany({
    data: [
      { userId: gestor.id, contractId: contract.id, role: 'GESTOR' },
      { userId: engenheiro.id, contractId: contract.id, role: 'ENGENHEIRO' },
    ]
  });

  // 5. Criar um Documento com Revisão 0 (R0)
  const doc = await prisma.document.create({
    data: {
      contractId: contract.id,
      codigoDocumento: 'VALE-CIV-PLA-001',
      titulo: 'Planta Baixa - Galpão Principal',
      disciplina: 'CIVIL',
      createdById: engenheiro.id,
      revisions: {
        create: {
          versionLabel: 'R0',
          filePath: 'uploads/GED-mock-file.pdf',
          fileHash: 'mock-hash-1234',
          status: 'APROVADO',
          approvedById: gestor.id,
          approvedAt: new Date()
        }
      }
    }
  });

  console.log('✅ Seed concluído!');
  console.log(`Cliente: ${client.nome} | Contrato: ${contract.codigo}`);
  console.log(`Documento criado: ${doc.codigoDocumento} (R0)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });