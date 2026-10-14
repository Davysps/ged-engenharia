import bcrypt from 'bcrypt';
import { prisma } from '../src/prisma';

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, senhaHash: true },
  });
  const legacyUsers = users.filter((user) => !BCRYPT_HASH_PATTERN.test(user.senhaHash));

  if (process.env.LEGACY_PASSWORD_MIGRATION_APPLY !== '1') {
    console.log(`Prévia: ${legacyUsers.length} conta(s) precisam ser convertidas para bcrypt.`);
    console.log('Nenhuma senha foi alterada. Para aplicar, defina LEGACY_PASSWORD_MIGRATION_APPLY=1.');
    return;
  }

  let migrated = 0;
  for (const user of legacyUsers) {
    const hashedPassword = await bcrypt.hash(user.senhaHash, 12);
    const result = await prisma.user.updateMany({
      where: { id: user.id, senhaHash: user.senhaHash },
      data: { senhaHash: hashedPassword },
    });
    if (result.count !== 1) {
      throw new Error('Uma conta mudou durante a migração; interrompendo para permitir nova execução segura.');
    }
    migrated += 1;
  }

  console.log(`${migrated} conta(s) convertida(s) para bcrypt. Nenhuma senha foi exibida.`);
}

main()
  .catch((error) => {
    console.error('Falha na migração de hashes de senha:', error instanceof Error ? error.message : 'erro desconhecido');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
