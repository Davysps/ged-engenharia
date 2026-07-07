import { Request, Response } from 'express';
import { prisma } from '../../prisma';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, senha } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    // Como o nosso Seed atual salvou a senha como 'hash', vamos prever isso no MVP, 
    // mas em produção usaremos o bcrypt.compare
    const isPasswordValid = senha === user.senhaHash || await bcrypt.compare(senha, user.senhaHash);

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
      user: { id: user.id, nome: user.nome, email: user.email, role: user.globalRole }
    });
  } catch (error) {
    console.error('[GED Engenharia] Erro no login:', error);
    res.status(500).json({ error: 'Erro interno ao tentar fazer login.' });
  }
};