import { z } from 'zod';

/**
 * Schemas Zod para validação de payloads e query params do Épico 6:
 * Gestão de Usuários e Disciplinas.
 *
 * Todos os schemas são estáticos e stateless, seguindo o princípio
 * de imutabilidade e reutilização. O controller os aplica via `.parse()`
 * antes de delegar para o service.
 */

// ─────────────────────────────────────────────────────────────────────
// Query Params: contractId (tenant identifier)
// ─────────────────────────────────────────────────────────────────────
export const contractIdQuerySchema = z.object({
  contractId: z.coerce.number().int().positive({
    message: 'O parâmetro contractId é obrigatório e deve ser um número positivo.',
  }),
});

export type ContractIdQueryInput = z.infer<typeof contractIdQuerySchema>;

// ─────────────────────────────────────────────────────────────────────
// Discipline (ContractDiscipline) Schemas
// ─────────────────────────────────────────────────────────────────────

/**
 * Schema base para uma Disciplina de Contrato.
 * Campos: nome, codigo, descricao (opcional).
 */
export const disciplineBaseSchema = z.object({
  nome: z.string().min(1, 'O nome da disciplina é obrigatório.').max(255, 'O nome da disciplina deve ter no máximo 255 caracteres.'),
  codigo: z.string().min(1, 'O código da disciplina é obrigatório.').max(100, 'O código da disciplina deve ter no máximo 100 caracteres.'),
  descricao: z.string().max(1000, 'A descrição da disciplina deve ter no máximo 1000 caracteres.').optional().or(z.literal('')),
});

/**
 * Schema para criação de uma nova disciplina.
 */
export const createDisciplineSchema = disciplineBaseSchema;

export type CreateDisciplineInput = z.infer<typeof createDisciplineSchema>;

/**
 * Schema para atualização parcial de uma disciplina.
 * Todos os campos são opcionais.
 */
export const updateDisciplineSchema = disciplineBaseSchema.partial();

export type UpdateDisciplineInput = z.infer<typeof updateDisciplineSchema>;

/**
 * Schema para o parâmetro de rota `disciplineId`.
 */
export const disciplineIdParamSchema = z.object({
  disciplineId: z.coerce.number().int().positive({
    message: 'O parâmetro disciplineId deve ser um número positivo.',
  }),
});

export type DisciplineIdParamInput = z.infer<typeof disciplineIdParamSchema>;

// ─────────────────────────────────────────────────────────────────────
// User (ContractMembership / Invite) Schemas
// ─────────────────────────────────────────────────────────────────────

/**
 * Schema para convidar (criar membro) um novo usuário a um contrato.
 *
 * RBAC: Apenas usuários com a role GESTOR no contrato podem convidar.
 */
export const inviteUserSchema = z.object({
  nome: z.string().min(1, 'O nome do usuário é obrigatório.').max(255, 'O nome do usuário deve ter no máximo 255 caracteres.'),
  email: z.string().email('O email fornecido não é válido.'),
  role: z.enum(['GESTOR', 'ENGENHEIRO', 'APROVADOR', 'LEITOR'], {
    error: 'A role fornecida não é válida. Valores aceitos: GESTOR, ENGENHEIRO, APROVADOR, LEITOR.',
  }),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
