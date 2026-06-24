import { prisma } from '../src/prisma';

async function main() {
  console.log('Iniciando o seed da base de dados...');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@engenharia.com' },
    update: {},
    create: {
      nome: 'Engenheiro Chefe',
      email: 'admin@engenharia.com',
      senhaHash: 'hash_falso_para_mvp',
      role: 'ADMIN',
    },
  });

  const projeto = await prisma.project.upsert({
    where: { codigo: 'PRJ-2026-MVP' },
    update: {},
    create: {
      codigo: 'PRJ-2026-MVP',
      nome: 'Projeto Piloto GED',
      descricao: 'Projeto inicial para testar o sistema de arquivos técnicos',
      cliente: 'Construtora Alfa',
    },
  });

  console.log('Seed concluído com sucesso!');
  console.log('Utilizador ID:', admin.id);
  console.log('Projeto ID:', projeto.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });