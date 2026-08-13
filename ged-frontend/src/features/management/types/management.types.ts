/**
 * Tipagens do Épico 6: Gestão de Usuários e Disciplinas (Frontend).
 *
 * Estas tipagens espelham o schema Prisma e os retornos do backend,
 * garantindo type-safety ponta a ponta.
 */

/**
 * Role de um usuário dentro de um contrato (RBAC).
 * Espelha o enum ContractRole do Prisma.
 */
export type ContractRole = 'GESTOR' | 'ENGENHEIRO' | 'APROVADOR' | 'LEITOR';

/**
 * Representa uma Disciplina de Contrato (ContractDiscipline no backend).
 * Cada contrato (tenant) tem sua própria lista de disciplinas.
 */
export interface ContractDiscipline {
  id: number;
  contractId: number;
  nome: string;
  codigo: string;
  descricao: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Representa um membro (usuário + role) de um contrato.
 * Retornado pela listagem de usuários (GET /management/users).
 */
export interface ContractUser {
  id: number;
  nome: string;
  email: string;
  role: ContractRole;
  createdAt: string;
}

/**
 * Payload para criação/edição de uma disciplina.
 */
export interface DisciplineFormInput {
  nome: string;
  codigo: string;
  descricao: string;
}

/**
 * Payload para convidar (invite) um novo usuário.
 */
export interface UserInviteInput {
  nome: string;
  email: string;
  role: ContractRole;
}
