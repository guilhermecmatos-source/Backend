import { query } from "../database/connection";

export class ReportsService {
  async getSummary(dateFrom?: string, dateTo?: string) {
    const dateFilter = dateFrom && dateTo ? "AND t.created_at BETWEEN ? AND ?" : "";
    const params: string[] = dateFrom && dateTo ? [dateFrom, `${dateTo} 23:59:59`] : [];

    const travelJoin = dateFilter
      ? "LEFT JOIN travels t ON t.vehicle_id = v.id AND t.created_at BETWEEN ? AND ?"
      : "LEFT JOIN travels t ON t.vehicle_id = v.id";
    const vehicleRows = await query<{
      plate: string;
      km: number;
      cost: number;
      efficiency: number;
    }>(
      `SELECT v.plate,
        CAST(COALESCE(SUM(t.distance_km),0) AS DECIMAL(12,2)) as km,
        CAST(COALESCE(SUM(t.cost),0) + COALESCE((
          SELECT SUM(f.cost) FROM fuel_records f WHERE f.vehicle_id = v.id
        ),0) AS DECIMAL(12,2)) as cost,
        CAST(COALESCE(AVG(CASE WHEN t.status = 'completed' THEN 100 ELSE 70 END),85) AS DECIMAL(5,2)) as efficiency
       FROM vehicles v
       ${travelJoin}
       GROUP BY v.id
       ORDER BY km DESC
       LIMIT 10`,
      dateFilter ? params : undefined
    );

    const topDrivers = await query<{
      name: string;
      score: number;
      km: number;
      cost_per_km: number;
    }>(
      `SELECT d.name,
        CAST(d.score AS DECIMAL(5,2)) as score,
        CAST(COALESCE(SUM(t.distance_km),0) AS DECIMAL(12,2)) as km,
        CAST(CASE WHEN COALESCE(SUM(t.distance_km),0) > 0
          THEN COALESCE(SUM(t.cost),0) / SUM(t.distance_km) ELSE 0 END AS DECIMAL(8,2)) as cost_per_km
       FROM drivers d
       LEFT JOIN travels t ON t.driver_id = d.id ${dateFilter ? "AND t.created_at BETWEEN ? AND ?" : ""}
       WHERE d.active = 1
       GROUP BY d.id
       ORDER BY d.score DESC, km DESC
       LIMIT 5`,
      dateFilter ? params : undefined
    );

    const [costs] = await query<{
      fuel: string;
      maintenance: string;
      travel: string;
    }>(
      `SELECT
        CAST(COALESCE((SELECT SUM(cost) FROM fuel_records),0) AS CHAR) as fuel,
        CAST(COALESCE((SELECT SUM(cost) FROM maintenances),0) AS CHAR) as maintenance,
        CAST(COALESCE((SELECT SUM(cost) FROM travels),0) AS CHAR) as travel`
    );

    const fuelCost = parseFloat(costs?.fuel ?? "0");
    const maintCost = parseFloat(costs?.maintenance ?? "0");
    const travelCost = parseFloat(costs?.travel ?? "0");
    const total = fuelCost + maintCost + travelCost || 1;

    const recentTravels = await query<{
      id: string;
      origin: string;
      destination: string;
      status: string;
      created_at: string;
      vehicle_plate: string;
    }>(
      `SELECT t.id, t.origin, t.destination, t.status, t.created_at, v.plate as vehicle_plate
       FROM travels t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       ORDER BY t.created_at DESC LIMIT 8`
    );

    const [travelStats] = await query<{ total: string; completed: string }>(
      `SELECT CAST(COUNT(*) AS CHAR) as total,
       CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS CHAR) as completed
       FROM travels ${dateFilter ? "WHERE created_at BETWEEN ? AND ?" : ""}`,
      dateFilter ? params : undefined
    );

    return {
      vehicleRows,
      topDrivers,
      costBreakdown: [
        { label: "Combustível", pct: Math.round((fuelCost / total) * 100), amount: fuelCost },
        { label: "Manutenção", pct: Math.round((maintCost / total) * 100), amount: maintCost },
        { label: "Viagens", pct: Math.round((travelCost / total) * 100), amount: travelCost },
      ],
      recentTravels,
      totals: {
        travels: parseInt(travelStats?.total ?? "0"),
        completed: parseInt(travelStats?.completed ?? "0"),
        totalCost: total,
      },
    };
  }
}

export const reportsService = new ReportsService();
