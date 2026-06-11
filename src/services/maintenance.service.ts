import { query } from "../database/connection";
import { Maintenance, MaintenanceType } from "../models/types";
import { predictiveService } from "../ai/predictive.service";
import { toMysqlDatetime } from "../utils/validators";

export class MaintenanceService {
  async findAll() {
    return query<Maintenance & { vehicle_plate: string }>(
      `SELECT m.*, v.plate as vehicle_plate FROM maintenances m
       JOIN vehicles v ON v.id = m.vehicle_id
       ORDER BY m.scheduled_at DESC`
    );
  }

  async create(data: {
    vehicle_id: string;
    type: MaintenanceType;
    description: string;
    cost?: number;
    scheduled_at: string;
  }) {
    const formattedDate = toMysqlDatetime(data.scheduled_at);
    const rows = await query<Maintenance>(
      `INSERT INTO maintenances (vehicle_id, type, description, cost, scheduled_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.vehicle_id, data.type, data.description, data.cost || 0, formattedDate]
    );

    if (data.type === "preventive") {
      await query(
        "UPDATE vehicles SET status = 'maintenance' WHERE id = $1",
        [data.vehicle_id]
      );
    }

    return rows[0];
  }

  async complete(id: string) {
    const rows = await query<Maintenance>(
      `UPDATE maintenances SET completed_at = NOW(), alert_sent = false
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (rows[0]) {
      await query(
        "UPDATE vehicles SET status = 'active', updated_at = NOW() WHERE id = $1",
        [rows[0].vehicle_id]
      );
    }
    return rows[0] || null;
  }

  async getAlerts() {
    const pending = await query<Maintenance & { vehicle_plate: string }>(
      `SELECT m.*, v.plate as vehicle_plate, v.mileage as vehicle_mileage FROM maintenances m
       JOIN vehicles v ON v.id = m.vehicle_id
       WHERE m.completed_at IS NULL
       ORDER BY m.scheduled_at ASC
       LIMIT 20`
    );

    const maintenanceVehicles = await query<{ plate: string; status: string }>(
      `SELECT plate, status FROM vehicles WHERE status = 'maintenance'`
    );

    const predictive = await predictiveService.generateAllAlerts();

    return {
      pending,
      maintenanceVehicles,
      predictive,
      count: pending.length + maintenanceVehicles.length,
    };
  }

  async emitAlerts() {
    const result = await this.getAlerts();
    const dueSoon = result.pending.filter(
      (m) => new Date(m.scheduled_at) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    );
    for (const m of dueSoon) {
      if (!m.alert_sent) {
        await query("UPDATE maintenances SET alert_sent = true WHERE id = $1", [m.id]);
      }
    }
    return { ...result, pendingMaintenance: dueSoon.length };
  }
}

export const maintenanceService = new MaintenanceService();
