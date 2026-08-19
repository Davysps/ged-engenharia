import { z } from 'zod';

/**
 * Schemas Zod para validação de payloads do módulo de Transmittals (GRD).
 *
 * Segue o mesmo padrão dos demais módulos: schemas estáticos e stateless,
 * aplicados via `.parse()` antes de qualquer delegação para o banco.
 */

// ─────────────────────────────────────────────────────────────────────
// Criação de GRD (ÉPICO 10.1) — GATEKEEPER DE EMISSÃO
// ─────────────────────────────────────────────────────────────────────
// Coerce cada id do lote para número (aceita strings numéricas), rejeitando
// valores nulos, vazios ou não-numéricos.
const revisionId = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === '') return undefined;
    return Number(value);
  },
  z.number({ message: 'Cada documento do lote deve ser um número válido.' }).int().positive({
    message: 'Cada documento do lote deve ser um número inteiro positivo.',
  })
);

export const createTransmittalSchema = z.object({
  assunto: z
    .string({ message: 'O assunto é obrigatório.' })
    .trim()
    .min(1, 'O assunto é obrigatório.')
    .max(500, 'O assunto deve ter no máximo 500 caracteres.'),
  mensagem: z
    .string()
    .trim()
    .max(5000, 'A mensagem deve ter no máximo 5000 caracteres.')
    .optional()
    .nullable(),
  destinatario: z
    .string()
    .trim()
    .max(100, 'O destinatário deve ter no máximo 100 caracteres.')
    .optional()
    .nullable(),
  proposito: z
    .string({ message: 'O propósito é obrigatório.' })
    .trim()
    .min(1, 'O propósito é obrigatório.')
    .max(100, 'O propósito deve ter no máximo 100 caracteres.'),
  revisionIds: z
    .array(revisionId, { message: 'O lote de documentos é obrigatório.' })
    .min(1, 'Pelo menos um documento válido deve ser selecionado para gerar a GRD.')
    .max(100, 'O lote não pode exceder 100 documentos.'),
});

export type CreateTransmittalInput = z.infer<typeof createTransmittalSchema>;