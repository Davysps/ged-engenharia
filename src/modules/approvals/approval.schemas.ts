import { z } from 'zod';

/**
 * Schemas Zod para validação dos payloads do módulo de Aprovações.
 *
 * ÉPICO 10 — Motor de Aprovação Estrito:
 * O corpo da requisição deve exigir um dos status exatos do fluxo
 * (APROVADO, APROVADO_COM_COMENTARIOS, REPROVADO) e opcionalmente um
 * comentário/justificativa técnica.
 */

export const approvalActionSchema = z.object({
  // Status exatos exigidos pelo fluxo de aprovação estrito
  status: z.enum(['APROVADO', 'APROVADO_COM_COMENTARIOS', 'REPROVADO'], {
    error:
      'O status deve ser um dos valores exatos: APROVADO, APROVADO_COM_COMENTARIOS ou REPROVADO.',
  }),
  // Comentário/justificativa técnica (obrigatório em APROVADO_COM_COMENTARIOS e REPROVADO)
  comments: z
    .string()
    .trim()
    .max(2000, 'O comentário deve ter no máximo 2000 caracteres.')
    .optional(),
});

export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;