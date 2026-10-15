import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import type { ContractRole } from '@prisma/client';
import { prisma } from '../prisma';
import { runWithTenant } from '../lib/tenantContext';

// Estendendo o Request do Express para incluir o ID do usuário logado
// e o contractId (tenant) ativo na requisição.
export interface AuthRequest extends Request {
  userId?: number;
  contractId?: number;
  contractRole?: ContractRole;
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

/**
 * Confirma membership no contrato antes de executar handlers que recebem
 * contractId diretamente. A extensão Prisma já pode ter esse ID no contexto,
 * mas o filtro composto exige também o userId autenticado.
 */
export const requireContractMembership = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }
  const userId = req.userId;

  const contractId = extractTenantContractId(req);
  if (contractId === undefined) {
    res.status(400).json({ error: 'contractId é obrigatório e deve ser válido.' });
    return;
  }

  authorizeContractMembership(req, res, next, userId, contractId);
};

const authorizeContractMembership = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  userId: number,
  contractId: number
): void => {
  prisma.contractMembership.findUnique({
    where: { userId_contractId: { userId, contractId } },
    select: { role: true },
  }).then((membership) => {
    if (!membership) {
      res.status(403).json({ error: 'Acesso negado: você não é membro deste contrato.' });
      return;
    }

    req.contractId = contractId;
    req.contractRole = membership.role;
    runWithTenant({ userId, contractId }, next);
  }).catch((error: unknown) => {
    console.error('[GED Engenharia] Erro ao validar membership do contrato.', error);
    res.status(500).json({ error: 'Não foi possível validar o acesso ao contrato.' });
  });
};

/** Resolve o contrato por um documento e valida membership antes do handler. */
export const requireDocumentMembership = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  const rawDocumentId = req.params.id ?? req.params.documentId ?? req.query.documentId ?? (req.body as any)?.documentId;
  const documentId = Number(rawDocumentId);
  if (!Number.isInteger(documentId) || documentId <= 0) {
    res.status(400).json({ error: 'documentId é obrigatório e deve ser válido.' });
    return;
  }

  const userId = req.userId;
  prisma.document.findFirst({
    where: {
      id: documentId,
      contract: { memberships: { some: { userId } } },
    },
    select: { contractId: true },
  }).then((document) => {
    if (!document) {
      res.status(404).json({ error: 'Documento não encontrado.' });
      return;
    }
    authorizeContractMembership(req, res, next, userId, document.contractId);
  }).catch((error: unknown) => {
    console.error('[GED Engenharia] Erro ao validar acesso ao documento.', error);
    res.status(500).json({ error: 'Não foi possível validar o acesso ao documento.' });
  });
};

/** Autoriza presign de documento novo por contrato ou upload de revisão por documento. */
export const requireContractOrDocumentMembership = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (extractTenantContractId(req) !== undefined) {
    requireContractMembership(req, res, next);
    return;
  }
  requireDocumentMembership(req, res, next);
};

/** Restringe operações de envio de documentos aos papéis que podem criar/revisar. */
export const requireDocumentWriteRole = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.contractRole || !['GESTOR', 'COORDENADOR'].includes(req.contractRole)) {
    res.status(403).json({ error: 'Acesso negado: apenas Gestores ou Coordenadores podem enviar documentos.' });
    return;
  }
  next();
};
