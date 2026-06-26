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
    let sql = `SELECT r.*, u.name as requester_name,
                      COALESCE(d.name, r.driver_id) as driver_name,
                      COALESCE(v.plate, r.vehicle_id) as vehicle_plate
               FROM ruv_requests r
               JOIN users u ON u.id = r.requester_id
               LEFT JOIN drivers d ON d.id = r.driver_id
               LEFT JOIN vehicles v ON v.id = r.vehicle_id`;
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
      `SELECT r.*, u.name as requester_name,
              COALESCE(d.name, r.driver_id) as driver_name,
              COALESCE(v.plate, r.vehicle_id) as vehicle_plate
       FROM ruv_requests r
       JOIN users u ON u.id = r.requester_id
       LEFT JOIN drivers d ON d.id = r.driver_id
       LEFT JOIN vehicles v ON v.id = r.vehicle_id
       WHERE r.id = $1`,
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
    vehicle_id?: string;
    driver_id?: string;
    time_from?: string;
    time_to?: string;
    vehicle_type?: string;
    authorization_ref?: string;
    fuel_type?: string;
    encarregado_signature?: string;
    route_change?: number;
    alt_destination?: string;
    alt_objective?: string;
    alt_date?: string;
    alt_signature?: string;
    auth_number?: string;
  }) {
    if (!data.origin?.trim() || !data.destination?.trim() || !data.purpose?.trim()) {
      throw new Error("Origem, destino e finalidade são obrigatórios.");
    }
    const rows = await query<RuvRequest>(
      `INSERT INTO ruv_requests (
        requester_id, origin, destination, purpose, passengers, status, descricao, quantidade,
        vehicle_id, driver_id, time_from, time_to, vehicle_type, authorization_ref, fuel_type,
        encarregado_signature, route_change, alt_destination, alt_objective, alt_date, alt_signature, auth_number
      ) VALUES ($1, $2, $3, $4, $5, 'pendente', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *`,
      [
        data.requester_id,
        data.origin.trim(),
        data.destination.trim(),
        data.purpose.trim(),
        data.passengers ?? 1,
        data.descricao || "",
        data.quantidade ?? 1,
        data.vehicle_id || null,
        data.driver_id || null,
        data.time_from || null,
        data.time_to || null,
        data.vehicle_type || null,
        data.authorization_ref || null,
        data.fuel_type || null,
        data.encarregado_signature || null,
        data.route_change ?? 0,
        data.alt_destination || null,
        data.alt_objective || null,
        data.alt_date || null,
        data.alt_signature || null,
        data.auth_number || null,
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
