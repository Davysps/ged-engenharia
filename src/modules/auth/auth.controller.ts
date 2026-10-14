import { Request, Response } from 'express';
import { prisma } from '../../prisma';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  senha: z.string().min(1).max(128),
});

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const credentials = loginSchema.safeParse(req.body);
    if (!credentials.success) {
      res.status(400).json({ error: 'E-mail ou senha em formato inválido.' });
      return;
    }
    const { email, senha } = credentials.data;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    // Senhas precisam estar armazenadas como hashes bcrypt. Nunca aceitar o
    // valor armazenado como senha em texto puro, nem mesmo durante o MVP.
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(senha, user.senhaHash);
    } catch {
      // Hash legado ou inválido não deve transformar credencial ruim em erro 500.
    }

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    // Validação estrita da variável de ambiente antes de assinar o token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[GED Engenharia] FATAL: JWT_SECRET não configurado no .env na hora do login.');
      res.status(500).json({ error: 'Erro interno de configuração do servidor.' });
      return;
    }

    // Gera o Token JWT válido por 1 dia
    const token = jwt.sign(
      { userId: user.id, globalRole: user.globalRole },
      secret,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      message: 'Login bem-sucedido',
      token,
      // PATCH 10.2: isClient exposto para a UI habilitar a Análise do Cliente pós-emissão
      user: { id: user.id, nome: user.nome, email: user.email, role: user.globalRole, isClient: user.isClient }
    });
  } catch (error) {
    console.error('[GED Engenharia] Erro no login:', error);
    res.status(500).json({ error: 'Erro interno ao tentar fazer login.' });
  }
};
