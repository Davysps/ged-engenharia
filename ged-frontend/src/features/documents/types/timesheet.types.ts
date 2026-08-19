/**
 * Tipagens do Épico 9: Apontamento de Horas (Frontend).
 *
 * Espelham o model Prisma `TimeLog` e o retorno do backend (que inclui
 * `user: { id, nome }`), garantindo type-safety ponta a ponta.
 */

/**
 * Info reduzida do usuário que lançou as horas (retornada pela API).
 */
export interface TimeLogUserInfo {
  id: number;
  nome: string;
}

/**
 * Representa um Apontamento de Horas (TimeLog) de um documento.
 */
export interface TimeLog {
  id: number;
  horas: number;
  data: string;
  descricao: string;
  userId: number;
  documentId: number | null;
  workPackageId: number | null;
  createdAt: string;
  updatedAt: string;
  user?: TimeLogUserInfo;
}

/**
 * Payload para criação de um apontamento.
 * O `documentId` é injetado pelo service a partir do documento em detalhe;
 * o `userId` é sempre definido pelo backend a partir do token JWT.
 */
export interface TimeLogFormInput {
  documentId: number;
  horas: number;
  data: string;
  descricao: string;
  workPackageId?: number | null;
}

/**
 * Dados que o formulário preenche (sem o documentId, que vem da rota).
 */
export type TimeLogFormValues = Omit<TimeLogFormInput, 'documentId'>;