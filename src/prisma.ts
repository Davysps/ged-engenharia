import 'dotenv/config'; // Garante que o .env é carregado antes de tudo
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL!;

// Configura o Pool de conexões e o Adaptador Oficial exigido pelo Prisma 7
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Exporta a instância única e configurada para o resto do sistema
export const prisma = new PrismaClient({ adapter });