/**
 * Definições de tipos que espelham os enums do Prisma Schema.
 * 
 * O frontend não tem acesso ao @prisma/client (não é uma dependência do
 * ged-frontend), então redefinimos os enums aqui como tipos TypeScript
 * para garantir type-safety sem importar a runtime do Prisma.
 * 
 * Fonte de verdade: prisma/schema.prisma
 */

export type GlobalRole = 'SYSADMIN' | 'USER';

export type ContractRole = 'GESTOR' | 'ENGENHEIRO' | 'APROVADOR' | 'LEITOR';

export type RevisionStatus =
  | 'EM_ELABORACAO'
  | 'EM_REVISAO'
  | 'APROVADO'
  | 'REJEITADO'
  | 'OBSOLETO';

// ÉPICO 10: Motor de Aprovação Estrito — status exatos exigidos pelo fluxo
export type ApprovalStatus =
  | 'PENDENTE'
  | 'APROVADO'
  | 'APROVADO_COM_COMENTARIOS'
  | 'REPROVADO';

export type Discipline =
  | 'ELETRICA'
  | 'HIDRAULICA'
  | 'ESTRUTURAL'
  | 'MECANICA'
  | 'CIVIL'
  | 'ARQUITETURA'
  | 'OUTRO';

export type TransmittalStatus = 'EM_PROCESSAMENTO' | 'CONCLUIDO' | 'ERRO';

export type DocumentOcrStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
