import { query } from "../database/connection";

export class IntelligenceService {
  async getMetrics() {
    const [vehicles, travels, fuel, drivers] = await Promise.all([
      query<{ total: string; active: string }>(
        `SELECT CAST(COUNT(*) AS CHAR) as total,
         CAST(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS CHAR) as active FROM vehicles`
      ),
      query<{ total: string; completed: string; in_progress: string }>(
        `SELECT CAST(COUNT(*) AS CHAR) as total,
         CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS CHAR) as completed,
         CAST(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS CHAR) as in_progress FROM travels`
      ),
      query<{ total_cost: string; total_liters: string }>(
        "SELECT CAST(COALESCE(SUM(cost),0) AS CHAR) as total_cost, CAST(COALESCE(SUM(liters),0) AS CHAR) as total_liters FROM fuel_records"
      ),
      query<{ avg_score: string }>(
        "SELECT CAST(COALESCE(AVG(score),0) AS CHAR) as avg_score FROM drivers WHERE active = 1"
      ),
    ]);

    const totalTravels = parseInt(travels[0].total);
    const completed = parseInt(travels[0].completed);
    const fuelCost = parseFloat(fuel[0].total_cost);
    const totalVehicles = parseInt(vehicles[0].total);
    const activeVehicles = parseInt(vehicles[0].active);

    const efficiency =
      totalTravels > 0 ? Math.round((completed / totalTravels) * 1000) / 10 : 0;
    const fleetUtilization =
      totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 1000) / 10 : 0;

    const [distanceSum] = await query<{ km: string }>(
      "SELECT CAST(COALESCE(SUM(distance_km),0) AS CHAR) as km FROM travels WHERE status = 'completed'"
    );
    const totalKm = parseFloat(distanceSum.km);
    const costPerKm = totalKm > 0 ? fuelCost / totalKm : 0;

    return {
      operationalEfficiency: efficiency,
      costPerDelivery: costPerKm,
      fleetUtilization,
      averageDriverScore: Math.round(parseFloat(drivers[0].avg_score) * 10) / 10,
      activeTrips: parseInt(travels[0].in_progress ?? "0"),
      totalFuelCost: fuelCost,
    };
  }

  async getDiscovery() {
    const underused = await query(
      `SELECT v.id, v.plate, v.brand, v.model, CAST(COUNT(t.id) AS UNSIGNED) as trip_count
       FROM vehicles v
       LEFT JOIN travels t ON t.vehicle_id = v.id AND t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY v.id
       HAVING trip_count < 2
       ORDER BY trip_count ASC
       LIMIT 5`
    );

    const highCost = await query(
      `SELECT v.plate, v.brand, CAST(SUM(f.cost) AS DECIMAL(12,2)) as total_cost
       FROM vehicles v
       JOIN fuel_records f ON f.vehicle_id = v.id
       GROUP BY v.id
       HAVING total_cost > (
         SELECT AVG(sub.total) FROM (
           SELECT SUM(cost) as total FROM fuel_records GROUP BY vehicle_id
         ) sub
       )
       ORDER BY total_cost DESC
       LIMIT 5`
    );

    const pendingRuv = await query<{ c: string }>(
      "SELECT CAST(COUNT(*) AS CHAR) as c FROM ruv_requests WHERE status = 'pendente'"
    );
    const pendingCount = parseInt(pendingRuv[0]?.c ?? "0");

    return {
      underusedVehicles: underused,
      highCostVehicles: highCost,
      pendingRequests: pendingCount,
      opportunities: [
        underused.length > 0
          ? `${underused.length} veículo(s) subutilizados nos últimos 30 dias.`
          : null,
        pendingCount > 0
          ? `${pendingCount} solicitação(ões) RUV pendente(s) de aprovação.`
          : null,
      ].filter(Boolean) as string[],
    };
  }

  async getRecentTravels(limit = 10) {
    const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));
    return query(
      `SELECT t.id, t.origin, t.destination, t.status, t.distance_km, t.cost,
              t.created_at, v.plate as vehicle_plate, d.name as driver_name
       FROM travels t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       LEFT JOIN drivers d ON d.id = t.driver_id
       ORDER BY t.created_at DESC
       LIMIT ${parsedLimit}`
    );
  }

  async getCeoInsights() {
    const topVehicle = await query<{ plate: string; brand: string; model: string; trips: number }>(
      `SELECT v.plate, v.brand, v.model, CAST(COUNT(t.id) AS UNSIGNED) as trips
       FROM vehicles v JOIN travels t ON t.vehicle_id = v.id
       GROUP BY v.id ORDER BY trips DESC LIMIT 1`
    );
    const topDriver = await query<{ name: string; trips: number }>(
      `SELECT d.name, CAST(COUNT(t.id) AS UNSIGNED) as trips
       FROM drivers d JOIN travels t ON t.driver_id = d.id
       GROUP BY d.id ORDER BY trips DESC LIMIT 1`
    );
    const expensiveVehicle = await query<{ plate: string; total: number }>(
      `SELECT v.plate, CAST(SUM(f.cost + COALESCE(m.cost,0)) AS DECIMAL(12,2)) as total
       FROM vehicles v
       LEFT JOIN fuel_records f ON f.vehicle_id = v.id
       LEFT JOIN maintenances m ON m.vehicle_id = v.id
       GROUP BY v.id ORDER BY total DESC LIMIT 1`
    );
    const opsCost = await query<{ total: string }>(
      `SELECT CAST(COALESCE(SUM(cost),0) + (
         SELECT COALESCE(SUM(cost),0) FROM maintenances
       ) AS CHAR) as total FROM fuel_records`
    );
    const pendingRuv = await query<{ c: string }>(
      "SELECT CAST(COUNT(*) AS CHAR) as c FROM ruv_requests WHERE status = 'pendente'"
    );

    return {
      mostUsedVehicle: topVehicle[0] ?? null,
      topDriver: topDriver[0] ?? null,
      mostExpensiveVehicle: expensiveVehicle[0] ?? null,
      operationalCost: parseFloat(opsCost[0]?.total ?? "0"),
      pendingRequests: parseInt(pendingRuv[0]?.c ?? "0"),
    };
  }
}

export const intelligenceService = new IntelligenceService();
