import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

// Estendendo o Request do Express para incluir o ID do usuário logado
export interface AuthRequest extends Request {
  userId?: number;
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Token não fornecido no cabeçalho.' });
    return;
  }

  const token = authHeader.split(' ')[1]; // Formato esperado: "Bearer <token>"

  // 1. Validação estrita: garante que a segunda parte (o token em si) realmente existe
  if (!token) {
    res.status(401).json({ error: 'Formato de token malformado. Use: Bearer <token>' });
    return;
  }

  // 2. Validação estrita da variável de ambiente
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[GED Engenharia] FATAL: JWT_SECRET não está configurado no arquivo .env');
    res.status(500).json({ error: 'Erro interno de configuração do servidor.' });
    return;
  }

  try {
    // 3. Utilizamos o tipo oficial JwtPayload fornecido pela própria biblioteca
    const decoded = jwt.verify(token, secret) as JwtPayload;
    
    // 4. Garantimos que o userId existe dentro do payload antes de atribuir
    if (decoded && decoded.userId) {
      req.userId = Number(decoded.userId);
      next();
    } else {
      res.status(401).json({ error: 'Token malformado: informações de usuário ausentes.' });
    }
  } catch (error) {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};