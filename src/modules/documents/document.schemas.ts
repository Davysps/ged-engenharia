import { z } from 'zod';

/**
 * Schemas Zod para validação de payloads e query params do módulo de
 * Documentos.
 *
 * Todos os schemas são estáticos e stateless, seguindo o princípio
 * de imutabilidade e reutilização. O controller os aplica via `.parse()`
 * antes de delegar para o service.
 */

// ─────────────────────────────────────────────────────────────────────
// Query Params de Listagem (Busca Avançada / Filtros Refinados)
// ─────────────────────────────────────────────────────────────────────
export const documentListQuerySchema = z.object({
  // Termo de busca livre (código ou título do documento)
  busca: z
    .string()
    .trim()
    .max(255, 'O termo de busca deve ter no máximo 255 caracteres.')
    .optional()
    .or(z.literal('')),
  // Filtro por Disciplina do Contrato (ContractDiscipline.id)
  disciplinaId: z.coerce
    .number()
    .int()
    .positive({ message: 'O parâmetro disciplinaId deve ser um número positivo.' })
    .optional(),
  // Filtro por Pacote de Trabalho (WorkPackage.id)
  pacoteId: z.coerce
    .number()
    .int()
    .positive({ message: 'O parâmetro pacoteId deve ser um número positivo.' })
    .optional(),
});

export type DocumentListQueryInput = z.infer<typeof documentListQuerySchema>;

// ─────────────────────────────────────────────────────────────────────
// Upload de Documento (R0) — campos do FormData (todos chegam como string)
// ─────────────────────────────────────────────────────────────────────
const optionalIntFromForm = z.preprocess(
  (value) => (value === undefined || value === null || value === '' ? undefined : Number(value)),
  z.number().int().positive().optional()
);

export const uploadDocumentSchema = z.object({
  contractId: z.coerce.number().int().positive({
    message: 'O parâmetro contractId é obrigatório e deve ser um número positivo.',
  }),
  codigoDocumento: z
    .string()
    .min(1, 'O código do documento é obrigatório.')
    .max(255, 'O código do documento deve ter no máximo 255 caracteres.'),
  titulo: z
    .string()
    .min(1, 'O título do documento é obrigatório.')
    .max(500, 'O título do documento deve ter no máximo 500 caracteres.'),
  // ÉPICO 7.5: Vínculos opcionais (string vazia ou ausente = sem vínculo)
  workPackageId: optionalIntFromForm,
  contractDisciplineId: optionalIntFromForm,
  // FASE 2 (Nível Enterprise): S3 Pre-signed URLs.
  // O arquivo já está no bucket quando o Backend é notificado; a fileKey
  // (retornada por POST /documents/presigned-url) é a única referência física.
  fileKey: z.string().min(1, 'A fileKey do arquivo enviado ao S3 é obrigatória.'),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

// ─────────────────────────────────────────────────────────────────────
// Solicitação de Pre-signed URL (FASE 2 — Nível Enterprise)
// O Frontend informa apenas nome e tipo do arquivo; o Backend gera a URL
// PUT autenticada e a fileKey que será usada na etapa de confirmação.
// ─────────────────────────────────────────────────────────────────────
export const presignedUrlSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, 'O nome do arquivo é obrigatório.')
    .max(255, 'O nome do arquivo deve ter no máximo 255 caracteres.'),
  fileType: z
    .string()
    .trim()
    .min(1, 'O tipo do arquivo (MIME) é obrigatório.')
    .max(100, 'O tipo do arquivo (MIME) deve ter no máximo 100 caracteres.'),
});

export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;

// ─────────────────────────────────────────────────────────────────────
// Parâmetro de rota: documentId
// ─────────────────────────────────────────────────────────────────────
export const documentIdParamSchema = z.object({
  id: z.coerce.number().int().positive({
    message: 'O parâmetro id deve ser um número positivo.',
  }),
});

export type DocumentIdParamInput = z.infer<typeof documentIdParamSchema>;
