import { z } from 'zod';

/**
 * Schemas Zod para validação de payloads e query params do Épico 9:
 * Módulo de Apontamento de Horas (Timesheet).
 *
 * Segue o mesmo padrão do planning.schemas.ts: schemas estáticos e
 * stateless, aplicados pelo controller via `.parse()` antes de delegar
 * para o service.
 */

// ─────────────────────────────────────────────────────────────────────
// Query Params: documentId (tenant identifier) + paginação simples
// ─────────────────────────────────────────────────────────────────────
export const listTimeLogsQuerySchema = z.object({
  documentId: z.coerce.number().int().positive({
    message: 'O parâmetro documentId é obrigatório e deve ser um número positivo.',
  }),
});

export type ListTimeLogsQueryInput = z.infer<typeof listTimeLogsQuerySchema>;

// ─────────────────────────────────────────────────────────────────────
// TimeLog (Apontamento de Horas) Schemas
// ─────────────────────────────────────────────────────────────────────

/**
 * Schema base para um TimeLog.
 * O `userId` NÃO entra aqui: é sempre extraído do token JWT autenticado.
 */
export const timeLogBaseSchema = z.object({
  documentId: z.coerce.number().int().positive({
    message: 'O documentId é obrigatório e deve ser um número positivo.',
  }),
  workPackageId: z.coerce.number().int().positive().optional().nullable(),
  horas: z.coerce
    .number()
    .positive('A quantidade de horas deve ser maior que zero.')
    .max(24, 'A quantidade de horas não pode ultrapassar 24h por lançamento.'),
  data: z.coerce.date({ error: 'A data do apontamento é obrigatória e deve ser uma data válida.' }),
  descricao: z
    .string()
    .min(1, 'A descrição do apontamento é obrigatória.')
    .max(2000, 'A descrição deve ter no máximo 2000 caracteres.'),
});

export const createTimeLogSchema = timeLogBaseSchema;

export type CreateTimeLogInput = z.infer<typeof createTimeLogSchema>;

/**
 * Schema para o parâmetro de rota `timeLogId`.
 */
export const timeLogIdParamSchema = z.object({
  timeLogId: z.coerce.number().int().positive({
    message: 'O parâmetro timeLogId deve ser um número positivo.',
  }),
});

export type TimeLogIdParamInput = z.infer<typeof timeLogIdParamSchema>;