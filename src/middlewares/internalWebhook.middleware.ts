import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/** Bloqueia callbacks internos quando o segredo não foi configurado e compara em tempo constante. */
export const requireInternalWebhookSecret = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const expected = process.env.GED_INTERNAL_SECRET;
  const provided = req.get('x-internal-secret');

  if (!expected) {
    res.status(503).json({ error: 'Webhook interno indisponível: segredo não configurado.' });
    return;
  }

  if (!provided) {
    res.status(401).json({ error: 'Acesso não autorizado para o serviço interno.' });
    return;
  }

  const expectedBytes = Buffer.from(expected, 'utf8');
  const providedBytes = Buffer.from(provided, 'utf8');
  if (expectedBytes.length !== providedBytes.length || !timingSafeEqual(expectedBytes, providedBytes)) {
    res.status(401).json({ error: 'Acesso não autorizado para o serviço interno.' });
    return;
  }

  next();
};
