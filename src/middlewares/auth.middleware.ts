import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { runWithTenant } from '../lib/tenantContext';

// Estendendo o Request do Express para incluir o ID do usuário logado
// e o contractId (tenant) ativo na requisição.
export interface AuthRequest extends Request {
  userId?: number;
  contractId?: number;
}

/**
 * Extrai o tenant (contractId)ativo da requisição autenticada.
 *
 * Como o JWT carrega apenas userId/globalRole e um usuário pode ser membro de
 * vários contratos, o tenant do momento é resolvido a partir da própria
 * requisição (query string, parâmetro de rota ou body). Valores ausentes ou
 * inválidos retornam undefined — a query segue SEM o filtro automático.
 */
function extractTenantContractId(req: Request): number | undefined {
  const raw =
    req.query?.contractId ??
    req.params?.contractId ??
    (req as any).body?.contractId;

  if (raw === undefined || raw === null || raw === '') return undefined;

  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
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
      const userId = Number(decoded.userId);
      req.userId = userId;

      const contractId = extractTenantContractId(req);
      if (contractId !== undefined) {
        req.contractId = contractId;
      }

      // 5. ETAPA 2.2 — Isolamento Multi-Tenant: envolve toda a continuação da
      // requisição no AsyncLocalStorage. A extensão do Prisma lê esse contexto
      // e injeta o `contractId` (tenant) automaticamente em todas as queries.
      const ctx: { userId?: number; contractId?: number } = { userId };
      if (contractId !== undefined) ctx.contractId = contractId;

      runWithTenant(ctx, next);
    } else {
      res.status(401).json({ error: 'Token malformado: informações de usuário ausentes.' });
    }
  } catch (error) {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};