import { query } from "../database/connection";
import { FuelRecord } from "../models/types";
import { predictiveService } from "../ai/predictive.service";

const SUSPICIOUS_LITERS = 120;

export class FuelService {
  async findAll() {
    return query<FuelRecord & { vehicle_plate: string }>(
      `SELECT f.*, v.plate as vehicle_plate FROM fuel_records f
       JOIN vehicles v ON v.id = f.vehicle_id
       ORDER BY f.filled_at DESC`
    );
  }

  async create(data: {
    vehicle_id: string;
    liters: number;
    cost: number;
    mileage_at_fill: number;
    station?: string;
    filled_at?: string;
    receipt_url?: string;
  }) {
    const suspicious = data.liters > SUSPICIOUS_LITERS;
    const rows = await query<FuelRecord>(
      `INSERT INTO fuel_records (vehicle_id, liters, cost, mileage_at_fill, station, filled_at, suspicious, receipt_url)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()), $7, $8) RETURNING *`,
      [data.vehicle_id, data.liters, data.cost, data.mileage_at_fill, data.station || null, data.filled_at || null, suspicious, data.receipt_url || null]
    );

    await query(
      "UPDATE vehicles SET mileage = $2, updated_at = NOW() WHERE id = $1 AND mileage < $2",
      [data.vehicle_id, data.mileage_at_fill]
    );

    return rows[0];
  }

  async getReport(vehicleId?: string) {
    const filter = vehicleId ? "WHERE f.vehicle_id = $1" : "";
    const params = vehicleId ? [vehicleId] : [];

    const summary = await query<{
      total_liters: string;
      total_cost: string;
      fill_count: string;
      suspicious_count: string;
    }>(
      `SELECT
        CAST(COALESCE(SUM(liters), 0) AS CHAR) as total_liters,
        CAST(COALESCE(SUM(cost), 0) AS CHAR) as total_cost,
        CAST(COUNT(*) AS CHAR) as fill_count,
        CAST(SUM(CASE WHEN suspicious = 1 THEN 1 ELSE 0 END) AS CHAR) as suspicious_count
       FROM fuel_records f ${filter}`,
      params
    );

    const byVehicle = await query(
      `SELECT v.plate, SUM(f.liters) as liters, SUM(f.cost) as cost, COUNT(*) as fills
       FROM fuel_records f JOIN vehicles v ON v.id = f.vehicle_id
       ${vehicleId ? "WHERE f.vehicle_id = $1" : ""}
       GROUP BY v.plate ORDER BY cost DESC`,
      params
    );

    return { summary: summary[0], byVehicle };
  }

  async detectPatterns(vehicleId: string) {
    return predictiveService.detectSuspiciousFuel(vehicleId);
  }
}

export const fuelService = new FuelService();
