import { query } from "../database/connection";
import { auditService } from "./audit.service";

export type RuvStatus = "pendente" | "aprovado" | "rejeitado" | "em_andamento" | "concluido";

export interface RuvRequest {
  id: string;
  requester_id: string;
  origin: string;
  destination: string;
  purpose: string;
  status: RuvStatus;
  passengers: number;
  descricao?: string | null;
  quantidade?: number;
  justification?: string | null;
  approved_by?: string | null;
  rejected_by?: string | null;
  vehicle_id?: string | null;
  driver_id?: string | null;
  requester_name?: string;
  created_at: Date;
  updated_at: Date;
}

export class RuvService {
  async findAll(status?: string) {
    let sql = `SELECT r.*, u.name as requester_name FROM ruv_requests r
      JOIN users u ON u.id = r.requester_id`;
    const params: string[] = [];
    if (status) {
      sql += " WHERE r.status = ?";
      params.push(status);
    }
    sql += " ORDER BY r.created_at DESC";
    return query<RuvRequest>(sql, params.length ? params : undefined);
  }

  async findById(id: string) {
    const rows = await query<RuvRequest>(
      `SELECT r.*, u.name as requester_name FROM ruv_requests r
       JOIN users u ON u.id = r.requester_id WHERE r.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async create(data: {
    requester_id: string;
    origin: string;
    destination: string;
    purpose: string;
    passengers?: number;
    descricao?: string;
    quantidade?: number;
  }) {
    if (!data.origin?.trim() || !data.destination?.trim() || !data.purpose?.trim()) {
      throw new Error("Origem, destino e finalidade são obrigatórios.");
    }
    const rows = await query<RuvRequest>(
      `INSERT INTO ruv_requests (requester_id, origin, destination, purpose, passengers, status, descricao, quantidade)
       VALUES ($1, $2, $3, $4, $5, 'pendente', $6, $7) RETURNING *`,
      [
        data.requester_id,
        data.origin.trim(),
        data.destination.trim(),
        data.purpose.trim(),
        data.passengers ?? 1,
        data.descricao || "",
        data.quantidade ?? 1,
      ]
    );
    return rows[0];
  }

  async approve(id: string, approverId: string, justification?: string) {
    await query(
      `UPDATE ruv_requests SET status = 'aprovado', approved_by = $2, justification = COALESCE($3, justification), updated_at = NOW() WHERE id = $1`,
      [id, approverId, justification ?? null]
    );
    return this.findById(id);
  }

  async reject(id: string, rejectorId: string, justification: string) {
    if (!justification?.trim()) throw new Error("Justificativa obrigatória para rejeição.");
    await query(
      `UPDATE ruv_requests SET status = 'rejeitado', rejected_by = $2, justification = $3, updated_at = NOW() WHERE id = $1`,
      [id, rejectorId, justification.trim()]
    );
    return this.findById(id);
  }

  async updateStatus(id: string, status: RuvStatus, userId: string, userEmail?: string) {
    await query(`UPDATE ruv_requests SET status = $2, updated_at = NOW() WHERE id = $1`, [
      id,
      status,
    ]);
    await auditService.log({
      entityType: "ruv_request",
      entityId: id,
      action: "update",
      userId,
      userEmail,
      details: `status=${status}`,
    });
    return this.findById(id);
  }
}

export const ruvService = new RuvService();
