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

  async logAuditoria(params: {
    userId?: string;
    userEmail?: string;
    action: string;
    details?: string;
    ipAddress?: string;
  }) {
    try {
      await query(
        `INSERT INTO logs_auditoria (user_id, user_email, action, details, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          params.userId ?? null,
          params.userEmail ?? null,
          params.action,
          params.details ?? null,
          params.ipAddress ?? null,
        ]
      );
      
      const { logger } = require("../utils/logger");
      logger.info(`Ação: ${params.action} | Usuário: ${params.userEmail || "Anônimo"} | IP: ${params.ipAddress || "N/A"} | Detalhes: ${params.details || "N/A"}`);
    } catch (err) {
      const { logger } = require("../utils/logger");
      logger.error(`Erro ao gravar logs_auditoria: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export const auditService = new AuditService();
