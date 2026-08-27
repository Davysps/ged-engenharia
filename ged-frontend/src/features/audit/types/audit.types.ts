/**
 * Tipagens do Épico 12: Trilha de Auditoria (Data Room & Audit Logs).
 */
export interface AuditLogUser {
  id: number;
  nome: string;
  email: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  entity: string;
  entityId: number;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: AuditLogUser;
}
