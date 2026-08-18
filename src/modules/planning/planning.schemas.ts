import { z } from 'zod';

/**
 * Schemas Zod para validação de payloads e query params do Épico 7:
 * Módulo de Planejamento e Coordenação (Pacotes de Trabalho).
 *
 * Todos os schemas são estáticos e stateless, seguindo o princípio
 * de imutabilidade e reutilização. O controller os aplica via `.parse()`
 * antes de delegar para o service.
 */

// ─────────────────────────────────────────────────────────────────────
// Status de um Work Package (Pacote de Trabalho)
// ─────────────────────────────────────────────────────────────────────
export const workPackageStatusSchema = z.enum(
  ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'ATRASADO', 'CANCELADO'],
  {
    error: 'Status inválido. Valores aceitos: PENDENTE, EM_ANDAMENTO, CONCLUIDO, ATRASADO, CANCELADO.',
  }
);

export type WorkPackageStatus = z.infer<typeof workPackageStatusSchema>;

// ─────────────────────────────────────────────────────────────────────
// Query Params: contractId (tenant identifier) + filtros de listagem
// ─────────────────────────────────────────────────────────────────────
export const listWorkPackagesQuerySchema = z.object({
  contractId: z.coerce.number().int().positive({
    message: 'O parâmetro contractId é obrigatório e deve ser um número positivo.',
  }),
  status: workPackageStatusSchema.optional(),
  busca: z
    .string()
    .max(200, 'O termo de busca deve ter no máximo 200 caracteres.')
    .optional()
    .or(z.literal('')),
});

export type ListWorkPackagesQueryInput = z.infer<typeof listWorkPackagesQuerySchema>;

// ─────────────────────────────────────────────────────────────────────
// Work Package (Pacote de Trabalho) Schemas
// ─────────────────────────────────────────────────────────────────────

/**
 * Schema base para um Work Package.
 * Campos: nome, descricao (opcional), dataInicio, dataFim, status (opcional).
 */
export const workPackageBaseSchema = z.object({
  nome: z.string().min(1, 'O nome do pacote de trabalho é obrigatório.').max(255, 'O nome deve ter no máximo 255 caracteres.'),
  descricao: z.string().max(2000, 'A descrição deve ter no máximo 2000 caracteres.').optional().or(z.literal('')),
  dataInicio: z.coerce.date({ error: 'A data de início é obrigatória e deve ser uma data válida.' }),
  dataFim: z.coerce.date({ error: 'A data de fim é obrigatória e deve ser uma data válida.' }),
  status: workPackageStatusSchema.optional(),
});

/**
 * Schema para criação de um novo Work Package.
 * Garante que a data de fim não seja anterior à data de início.
 */
export const createWorkPackageSchema = workPackageBaseSchema.refine(
  (data) => data.dataFim >= data.dataInicio,
  {
    message: 'A data de fim não pode ser anterior à data de início.',
    path: ['dataFim'],
  }
);

export type CreateWorkPackageInput = z.infer<typeof createWorkPackageSchema>;

/**
 * Schema para atualização parcial de um Work Package.
 * Todos os campos são opcionais.
 */
export const updateWorkPackageSchema = workPackageBaseSchema
  .partial()
  .refine(
    (data) => {
      if (data.dataInicio === undefined || data.dataFim === undefined) return true;
      return data.dataFim >= data.dataInicio;
    },
    {
      message: 'A data de fim não pode ser anterior à data de início.',
      path: ['dataFim'],
    }
  );

export type UpdateWorkPackageInput = z.infer<typeof updateWorkPackageSchema>;

/**
 * Schema para o parâmetro de rota `workPackageId`.
 */
export const workPackageIdParamSchema = z.object({
  workPackageId: z.coerce.number().int().positive({
    message: 'O parâmetro workPackageId deve ser um número positivo.',
  }),
});

export type WorkPackageIdParamInput = z.infer<typeof workPackageIdParamSchema>;
