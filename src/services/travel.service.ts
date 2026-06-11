import { query } from "../database/connection";
import { Travel, TravelStatus } from "../models/types";
import { vehicleService } from "./vehicle.service";
import { driverService } from "./driver.service";

export class TravelService {
  async findAll(search?: string) {
    let sql = `SELECT t.*, v.plate as vehicle_plate, d.name as driver_name
       FROM travels t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       LEFT JOIN drivers d ON d.id = t.driver_id`;
    const params: string[] = [];
    if (search?.trim()) {
      sql += ` WHERE t.origin LIKE ? OR t.destination LIKE ? OR v.plate LIKE ? OR d.name LIKE ?`;
      const q = `%${search.trim()}%`;
      params.push(q, q, q, q);
    }
    sql += " ORDER BY t.created_at DESC";
    return query<Travel>(sql, params.length ? params : undefined);
  }

  async findById(id: string) {
    const rows = await query<Travel>(
      `SELECT t.*, v.plate as vehicle_plate, d.name as driver_name
       FROM travels t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       LEFT JOIN drivers d ON d.id = t.driver_id
       WHERE t.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async validateRefs(vehicleId: string, driverId: string) {
    if (!vehicleId?.trim()) throw new Error("Veículo é obrigatório.");
    if (!driverId?.trim()) throw new Error("Motorista é obrigatório.");
    const vehicle = await vehicleService.findById(vehicleId);
    if (!vehicle) throw new Error("Veículo não cadastrado no sistema.");
    const driver = await driverService.findById(driverId);
    if (!driver) throw new Error("Motorista não cadastrado no sistema.");
    if (vehicle.status === "inactive") {
      throw new Error("Veículo inativo não pode ser usado em viagens.");
    }
    return { vehicle, driver };
  }

  async create(data: {
    vehicle_id: string;
    driver_id: string;
    origin: string;
    destination: string;
    distance_km?: number;
    fuel_consumption?: number;
    km_start?: number;
    km_end?: number;
    estimated_duration_min?: number;
    cost?: number;
    checklist_departure?: Record<string, unknown>;
    checklist_arrival?: Record<string, unknown>;
  }) {
    if (!data.origin?.trim() || !data.destination?.trim()) {
      throw new Error("Origem e destino são obrigatórios.");
    }
    const { vehicle, driver } = await this.validateRefs(data.vehicle_id, data.driver_id);

    const distanceKm = Number(data.distance_km || 0);
    const avgConsumption = Number(vehicle.avg_consumption || 10);
    const fuelConsumption =
      data.fuel_consumption && data.fuel_consumption > 0
        ? data.fuel_consumption
        : distanceKm > 0
          ? Math.round((distanceKm / avgConsumption) * 10) / 10
          : 0;
    const estimatedDuration =
      data.estimated_duration_min ??
      (distanceKm > 0 ? Math.round((distanceKm / 60) * 60) : null);
    const autonomyKm = Number(vehicle.autonomy_km || 0);
    const estimatedCost =
      data.cost && data.cost > 0
        ? data.cost
        : fuelConsumption > 0
          ? Math.round(fuelConsumption * 5.9 * 100) / 100
          : 0;

    if (autonomyKm > 0 && distanceKm > autonomyKm) {
      throw new Error(
        `Distância (${distanceKm} km) excede a autonomia estimada do veículo (${autonomyKm} km).`
      );
    }

    void driver;

    const rows = await query<Travel>(
      `INSERT INTO travels (vehicle_id, driver_id, origin, destination, distance_km, fuel_consumption, status, km_start, km_end, estimated_duration_min, cost, checklist_departure, checklist_arrival)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        data.vehicle_id,
        data.driver_id,
        data.origin.trim(),
        data.destination.trim(),
        distanceKm,
        fuelConsumption,
        data.km_start ?? vehicle.mileage ?? null,
        data.km_end ?? null,
        estimatedDuration,
        estimatedCost,
        data.checklist_departure ? JSON.stringify(data.checklist_departure) : null,
        data.checklist_arrival ? JSON.stringify(data.checklist_arrival) : null,
      ]
    );
    return this.findById(rows[0].id);
  }

  async update(id: string, data: Partial<Travel> & { vehicle_id?: string; driver_id?: string }) {
    const current = await this.findById(id);
    if (!current) return null;

    const vehicleId = data.vehicle_id ?? current.vehicle_id;
    const driverId = data.driver_id ?? current.driver_id;
    if (vehicleId && driverId) await this.validateRefs(vehicleId, driverId);

    await query<Travel>(
      `UPDATE travels SET
        vehicle_id = COALESCE($2, vehicle_id),
        driver_id = COALESCE($3, driver_id),
        origin = COALESCE($4, origin),
        destination = COALESCE($5, destination),
        distance_km = COALESCE($6, distance_km),
        fuel_consumption = COALESCE($7, fuel_consumption),
        status = COALESCE($8, status),
        km_start = COALESCE($9, km_start),
        km_end = COALESCE($10, km_end),
        estimated_duration_min = COALESCE($11, estimated_duration_min),
        cost = COALESCE($12, cost),
        checklist_departure = COALESCE($13, checklist_departure),
        checklist_arrival = COALESCE($14, checklist_arrival)
       WHERE id = $1`,
      [
        id,
        data.vehicle_id,
        data.driver_id,
        data.origin,
        data.destination,
        data.distance_km,
        data.fuel_consumption,
        data.status,
        data.km_start,
        data.km_end,
        data.estimated_duration_min,
        data.cost,
        data.checklist_departure ? JSON.stringify(data.checklist_departure) : undefined,
        data.checklist_arrival ? JSON.stringify(data.checklist_arrival) : undefined,
      ]
    );
    return this.findById(id);
  }

  async delete(id: string) {
    const rows = await query("DELETE FROM travels WHERE id = $1 RETURNING id", [id]);
    return rows.length > 0;
  }

  async findCarpoolMatches() {
    return query<{
      id: string;
      origin: string;
      destination: string;
      status: string;
      vehicle_plate: string;
      driver_name: string;
      match_score: number;
    }>(
      `SELECT t.id, t.origin, t.destination, t.status, v.plate as vehicle_plate, d.name as driver_name,
        CAST((
          SELECT COUNT(*) FROM travels t2
          WHERE t2.id != t.id AND t2.status IN ('scheduled', 'in_progress')
          AND (
            LOWER(t2.origin) LIKE CONCAT('%', SUBSTRING_INDEX(LOWER(t.origin), ',', 1), '%')
            OR LOWER(t2.destination) LIKE CONCAT('%', SUBSTRING_INDEX(LOWER(t.destination), ',', 1), '%')
          )
        ) AS UNSIGNED) as match_score
       FROM travels t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       LEFT JOIN drivers d ON d.id = t.driver_id
       WHERE t.status IN ('scheduled', 'in_progress')
       ORDER BY match_score DESC, t.created_at DESC
       LIMIT 10`
    );
  }

  async cancel(id: string) {
    const rows = await query<Travel>(
      `UPDATE travels SET status = 'cancelled' WHERE id = $1 AND status != 'completed' RETURNING *`,
      [id]
    );
    return rows[0] || null;
  }

  async updateStatus(id: string, status: TravelStatus) {
    return this.update(id, { status });
  }
}

export const travelService = new TravelService();
