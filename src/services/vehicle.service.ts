import { query } from "../database/connection";
import { Vehicle, VehicleStatus } from "../models/types";
import { normalizePlate, validatePlate } from "../utils/validators";

export class VehicleService {
  async findAll() {
    const vehicles = await query<Vehicle>(
      "SELECT * FROM vehicles ORDER BY created_at DESC"
    );
    return Promise.all(vehicles.map((v) => this.enrichMetrics(v)));
  }

  async enrichMetrics(vehicle: Vehicle): Promise<Vehicle & { avg_consumption?: number; autonomy_km?: number }> {
    const fuel = await query<{ avg_km_per_l: string }>(
      `SELECT AVG(
         CASE WHEN prev.mileage_at_fill > 0 AND f.mileage_at_fill > prev.mileage_at_fill AND f.liters > 0
         THEN (f.mileage_at_fill - prev.mileage_at_fill) / f.liters ELSE NULL END
       ) as avg_km_per_l
       FROM fuel_records f
       LEFT JOIN fuel_records prev ON prev.vehicle_id = f.vehicle_id
         AND prev.filled_at < f.filled_at
       WHERE f.vehicle_id = ?`,
      [vehicle.id]
    );
    const computedAvg = fuel[0]?.avg_km_per_l ? parseFloat(fuel[0].avg_km_per_l) : undefined;
    const avgConsumption = vehicle.avg_consumption ?? computedAvg;
    const autonomy =
      vehicle.autonomy_km ??
      (avgConsumption && avgConsumption > 0 ? Math.round(avgConsumption * 50) : undefined);
    return { ...vehicle, avg_consumption: avgConsumption, autonomy_km: autonomy };
  }

  async findById(id: string) {
    const rows = await query<Vehicle>("SELECT * FROM vehicles WHERE id = $1", [id]);
    if (!rows[0]) return null;
    return this.enrichMetrics(rows[0]);
  }

  async findByPlate(plate: string) {
    const normalized = normalizePlate(plate);
    const rows = await query<Vehicle>(
      "SELECT * FROM vehicles WHERE REPLACE(UPPER(plate), '-', '') = $1 OR plate = $2",
      [normalized, plate]
    );
    return rows[0] || null;
  }

  async create(data: {
    plate: string;
    brand: string;
    model: string;
    year: number;
    status?: VehicleStatus;
    mileage?: number;
    avg_consumption?: number;
    autonomy_km?: number;
  }) {
    const plateCheck = validatePlate(data.plate);
    if (!plateCheck.valid) throw new Error(plateCheck.message);
    const normalized = normalizePlate(data.plate);
    const dup = await this.findByPlate(normalized);
    if (dup) throw new Error("Placa já cadastrada.");

    const rows = await query<Vehicle>(
      `INSERT INTO vehicles (plate, brand, model, year, status, mileage, avg_consumption, autonomy_km)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        normalized,
        data.brand,
        data.model,
        data.year,
        data.status || "active",
        data.mileage || 0,
        data.avg_consumption ?? null,
        data.autonomy_km ?? null,
      ]
    );
    return rows[0];
  }

  async update(id: string, data: Partial<Vehicle>) {
    if (data.plate) {
      const plateCheck = validatePlate(data.plate);
      if (!plateCheck.valid) throw new Error(plateCheck.message);
      const normalized = normalizePlate(data.plate);
      const dup = await this.findByPlate(normalized);
      if (dup && dup.id !== id) throw new Error("Placa já cadastrada.");
      data.plate = normalized;
    }
    const rows = await query<Vehicle>(
      `UPDATE vehicles SET
        plate = COALESCE($2, plate),
        brand = COALESCE($3, brand),
        model = COALESCE($4, model),
        year = COALESCE($5, year),
        status = COALESCE($6, status),
        mileage = COALESCE($7, mileage),
        avg_consumption = COALESCE($8, avg_consumption),
        autonomy_km = COALESCE($9, autonomy_km),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        data.plate,
        data.brand,
        data.model,
        data.year,
        data.status,
        data.mileage,
        data.avg_consumption,
        data.autonomy_km,
      ]
    );
    return rows[0] || null;
  }

  async getLinkedCounts(id: string) {
    const [travels, fuel, maint] = await Promise.all([
      query<{ c: string }>("SELECT CAST(COUNT(*) AS CHAR) as c FROM travels WHERE vehicle_id = $1", [id]),
      query<{ c: string }>("SELECT CAST(COUNT(*) AS CHAR) as c FROM fuel_records WHERE vehicle_id = $1", [id]),
      query<{ c: string }>("SELECT CAST(COUNT(*) AS CHAR) as c FROM maintenances WHERE vehicle_id = $1", [id]),
    ]);
    return {
      travels: parseInt(travels[0]?.c ?? "0"),
      fuel: parseInt(fuel[0]?.c ?? "0"),
      maintenance: parseInt(maint[0]?.c ?? "0"),
    };
  }

  async delete(id: string) {
    const linked = await this.getLinkedCounts(id);
    if (linked.travels > 0 || linked.fuel > 0 || linked.maintenance > 0) {
      throw new Error(
        "Veículo possui viagens, abastecimentos ou manutenções vinculadas e não pode ser excluído."
      );
    }
    const rows = await query("DELETE FROM vehicles WHERE id = $1 RETURNING id", [id]);
    return rows.length > 0;
  }

  async getFuelHistory(vehicleId: string) {
    return query(
      "SELECT * FROM fuel_records WHERE vehicle_id = $1 ORDER BY filled_at DESC",
      [vehicleId]
    );
  }

  async getMaintenanceHistory(vehicleId: string) {
    return query(
      "SELECT * FROM maintenances WHERE vehicle_id = $1 ORDER BY scheduled_at DESC",
      [vehicleId]
    );
  }
}

export const vehicleService = new VehicleService();
