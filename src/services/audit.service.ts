import { query } from "../database/connection";

export type AuditAction = "create" | "update" | "delete";

export class AuditService {
  async log(params: {
    entityType: string;
    entityId: string;
    action: AuditAction;
    userId?: string;
    userEmail?: string;
    details?: string;
  }) {
    await query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, user_id, user_email, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.entityType,
        params.entityId,
        params.action,
        params.userId ?? null,
        params.userEmail ?? null,
        params.details ?? null,
      ]
    );
  }

  async findByEntity(entityType: string, entityId?: string, limit = 50) {
    const parsedLimit = Math.min(100, Math.max(1, limit));
    if (entityId) {
      return query(
        `SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ?
         ORDER BY created_at DESC LIMIT ${parsedLimit}`,
        [entityType, entityId]
      );
    }
    return query(
      `SELECT * FROM audit_logs WHERE entity_type = ?
       ORDER BY created_at DESC LIMIT ${parsedLimit}`,
      [entityType]
    );
  }
}

export const auditService = new AuditService();
