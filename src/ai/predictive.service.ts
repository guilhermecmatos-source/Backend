import { query } from "../database/connection";
import { PredictiveAlert } from "../models/types";

const PREVENTIVE_KM_THRESHOLD = 10000;
const SUSPICIOUS_LITERS_THRESHOLD = 120;
const LOW_DRIVER_SCORE = 60;

export class PredictiveService {
  async analyzeVehicleMaintenance(vehicleId: string): Promise<PredictiveAlert[]> {
    const alerts: PredictiveAlert[] = [];

    const vehicles = await query<{ mileage: number; plate: string }>(
      "SELECT mileage, plate FROM vehicles WHERE id = $1",
      [vehicleId]
    );
    if (vehicles.length === 0) return alerts;

    const vehicle = vehicles[0];
    const lastMaintenance = await query<{ completed_at: Date | null }>(
      `SELECT completed_at FROM maintenances
       WHERE vehicle_id = $1 AND type = 'preventive'
       ORDER BY scheduled_at DESC LIMIT 1`,
      [vehicleId]
    );

    const kmSinceService = lastMaintenance.length
      ? Number(vehicle.mileage)
      : Number(vehicle.mileage);

    if (kmSinceService >= PREVENTIVE_KM_THRESHOLD) {
      alerts.push({
        vehicleId,
        type: "preventive_maintenance",
        severity: kmSinceService >= PREVENTIVE_KM_THRESHOLD * 1.5 ? "high" : "medium",
        message: `Vehicle ${vehicle.plate} has traveled ${kmSinceService} km since last preventive service.`,
        recommendation: "Schedule preventive maintenance within 7 days.",
      });
    }

    return alerts;
  }

  async detectSuspiciousFuel(vehicleId: string): Promise<PredictiveAlert[]> {
    const records = await query<{ liters: number; filled_at: Date }>(
      `SELECT liters, filled_at FROM fuel_records
       WHERE vehicle_id = $1 ORDER BY filled_at DESC LIMIT 5`,
      [vehicleId]
    );

    const alerts: PredictiveAlert[] = [];
    for (const record of records) {
      if (Number(record.liters) > SUSPICIOUS_LITERS_THRESHOLD) {
        alerts.push({
          vehicleId,
          type: "suspicious_fuel",
          severity: "high",
          message: `Abnormal fuel volume detected: ${record.liters} liters.`,
          recommendation: "Review fuel receipt and verify tank capacity.",
        });
      }
    }
    return alerts;
  }

  async analyzeConsumption(vehicleId: string): Promise<{
    avgKmPerLiter: number;
    totalCost: number;
    recommendation: string;
  }> {
    const fuelData = await query<{ liters: number; cost: number }>(
      `SELECT liters, cost FROM fuel_records WHERE vehicle_id = $1`,
      [vehicleId]
    );
    const travelData = await query<{ distance_km: number }>(
      `SELECT distance_km FROM travels
       WHERE vehicle_id = $1 AND status = 'completed'`,
      [vehicleId]
    );

    const totalLiters = fuelData.reduce((s, r) => s + Number(r.liters), 0);
    const totalCost = fuelData.reduce((s, r) => s + Number(r.cost), 0);
    const totalKm = travelData.reduce((s, r) => s + Number(r.distance_km), 0);
    const avgKmPerLiter = totalLiters > 0 ? totalKm / totalLiters : 0;

    let recommendation = "Consumption within expected parameters.";
    if (avgKmPerLiter > 0 && avgKmPerLiter < 8) {
      recommendation = "High fuel consumption detected. Check vehicle condition and driving patterns.";
    }

    return { avgKmPerLiter: Math.round(avgKmPerLiter * 100) / 100, totalCost, recommendation };
  }

  async calculateDriverScore(driverId: string): Promise<number> {
    const travels = await query<{ status: string; fuel_consumption: number }>(
      `SELECT status, fuel_consumption FROM travels WHERE driver_id = $1`,
      [driverId]
    );

    if (travels.length === 0) return 100;

    const completed = travels.filter((t) => t.status === "completed").length;
    const cancelled = travels.filter((t) => t.status === "cancelled").length;
    const avgConsumption =
      travels.reduce((s, t) => s + Number(t.fuel_consumption), 0) / travels.length;

    let score = 100;
    score -= cancelled * 5;
    score += (completed / travels.length) * 10;
    if (avgConsumption > 15) score -= 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  async predictLogisticsDemand(): Promise<{
    expectedTrips: number;
    peakDays: string[];
    recommendation: string;
  }> {
    const last30Days = await query<{ count: string }>(
      `SELECT CAST(COUNT(*) AS CHAR) as count FROM travels
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const count = parseInt(last30Days[0]?.count || "0", 10);
    const dailyAvg = count / 30;
    const expectedTrips = Math.ceil(dailyAvg * 7);

    return {
      expectedTrips,
      peakDays: ["Monday", "Wednesday", "Friday"],
      recommendation: `Plan for approximately ${expectedTrips} trips next week based on historical data.`,
    };
  }

  async generateAllAlerts(): Promise<PredictiveAlert[]> {
    const vehicles = await query<{ id: string }>("SELECT id FROM vehicles WHERE status = 'active'");
    const allAlerts: PredictiveAlert[] = [];

    for (const v of vehicles) {
      const maintenance = await this.analyzeVehicleMaintenance(v.id);
      const fuel = await this.detectSuspiciousFuel(v.id);
      allAlerts.push(...maintenance, ...fuel);
    }

    const lowScoreDrivers = await query<{ id: string; name: string; score: number }>(
      "SELECT id, name, score FROM drivers WHERE score < $1",
      [LOW_DRIVER_SCORE]
    );
    for (const d of lowScoreDrivers) {
      allAlerts.push({
        vehicleId: "",
        type: "driver_performance",
        severity: "medium",
        message: `Driver ${d.name} has a low performance score (${d.score}).`,
        recommendation: "Schedule driver evaluation and training.",
      });
    }

    return allAlerts;
  }
}

export const predictiveService = new PredictiveService();
