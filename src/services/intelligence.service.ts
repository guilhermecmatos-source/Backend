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
  async getDriverScores() {
    const drivers = await query<{
      id: string;
      name: string;
      score: string;
      cnh_category: string;
      status: string;
      completed_trips: string;
      cancelled_trips: string;
      total_km: string;
    }>(
      `SELECT d.id, d.name,
              CAST(COALESCE(d.score, 0) AS CHAR) as score,
              COALESCE(d.cnh_category, 'N/A') as cnh_category,
              COALESCE(d.status, 'ativo') as status,
              CAST(SUM(CASE WHEN t.status='completed' THEN 1 ELSE 0 END) AS CHAR) as completed_trips,
              CAST(SUM(CASE WHEN t.status='cancelled' THEN 1 ELSE 0 END) AS CHAR) as cancelled_trips,
              CAST(COALESCE(SUM(CASE WHEN t.status='completed' THEN t.distance_km ELSE 0 END),0) AS CHAR) as total_km
       FROM drivers d
       LEFT JOIN travels t ON t.driver_id = d.id
       WHERE d.active = 1
       GROUP BY d.id
       ORDER BY d.score DESC`
    );

    return drivers.map((d) => {
      const completed = parseInt(d.completed_trips);
      const cancelled = parseInt(d.cancelled_trips);
      const total = completed + cancelled;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 100;
      const baseScore = parseFloat(d.score);
      // Score composto: 70% score BD + 30% taxa de conclusão
      const compositeScore = Math.round((baseScore * 0.7 + completionRate * 0.3) * 10) / 10;

      let badge: string;
      if (compositeScore >= 85) badge = "Excelente";
      else if (compositeScore >= 70) badge = "Bom";
      else if (compositeScore >= 50) badge = "Regular";
      else badge = "Crítico";

      return {
        id: d.id,
        name: d.name,
        score: compositeScore,
        badge,
        cnhCategory: d.cnh_category,
        status: d.status,
        completedTrips: completed,
        cancelledTrips: cancelled,
        totalKm: parseFloat(d.total_km),
        completionRate,
      };
    });
  }

  async getPredictiveParts() {
    const vehicles = await query<{
      id: string;
      plate: string;
      brand: string;
      model: string;
      mileage: string;
      last_maintenance: string | null;
    }>(
      `SELECT v.id, v.plate, v.brand, v.model,
              CAST(v.mileage AS CHAR) as mileage,
              MAX(m.scheduled_at) as last_maintenance
       FROM vehicles v
       LEFT JOIN maintenances m ON m.vehicle_id = v.id
       WHERE v.status != 'inactive'
       GROUP BY v.id
       ORDER BY v.mileage DESC`
    );

    const result = [];

    for (const v of vehicles) {
      const mileage = parseFloat(v.mileage);
      const vehicleId = v.id;
      const plate = v.plate;

      // Buscar contagens de manutenções corretivas e preventivas
      const maintCounts = await query<{ type: string; count: number }>(
        `SELECT type, CAST(COUNT(*) AS UNSIGNED) as count 
         FROM maintenances 
         WHERE vehicle_id = $1
         GROUP BY type`,
        [vehicleId]
      );
      
      let correctiveCount = 0;
      let preventiveCount = 0;
      maintCounts.forEach(m => {
        if (m.type === "corrective") correctiveCount = Number(m.count);
        if (m.type === "preventive") preventiveCount = Number(m.count);
      });

      // Buscar alertas térmicos/críticos associados à placa do veículo
      const thermalAlertsCountResult = await query<{ count: number }>(
        `SELECT CAST(COUNT(*) AS UNSIGNED) as count 
         FROM telemetry_alerts 
         WHERE (message LIKE CONCAT('%', $1, '%') OR title LIKE CONCAT('%', $1, '%'))
           AND (LOWER(message) LIKE '%termico%' OR LOWER(message) LIKE '%térmico%' OR LOWER(message) LIKE '%temperatura%' OR LOWER(message) LIKE '%aquecimento%' OR LOWER(title) LIKE '%termico%' OR LOWER(title) LIKE '%térmico%')`,
        [plate]
      );
      const thermalAlerts = Number(thermalAlertsCountResult[0]?.count ?? 0);

      // Lógica de análise preditiva (regressão logística multivariável)
      // z = intercepto + b1 * km + b2 * alertas_termicos + b3 * corretivas - b4 * preventivas
      const b0 = -1.5; // Risco base inicial
      const b1 = 0.000008; // Fator de desgaste por KM rodado
      const b2 = 1.5; // Alertas térmicos são sinais críticos de sobreaquecimento / falha
      const b3 = 0.5; // Manutenções corretivas indicam falhas reincidentes
      const b4 = 0.6; // Manutenções preventivas reduzem a chance de falha mecânica

      const z = b0 + (b1 * mileage) + (b2 * thermalAlerts) + (b3 * correctiveCount) - (b4 * preventiveCount);
      const probability = Math.round((1 / (1 + Math.exp(-z))) * 100);

      // Intervalos padrão de peças (km)
      const OIL_FILTER_INTERVAL = 10000;
      const BRAKE_FLUID_INTERVAL = 40000;
      const WIRING_INTERVAL = 80000;

      // Desgaste atenuado por manutenções preventivas e acelerado por corretivas
      const factor = Math.max(0.6, Math.min(1.4, 1 + (correctiveCount * 0.1) - (preventiveCount * 0.15)));

      const oilFilterKmLeft = Math.max(100, Math.round((OIL_FILTER_INTERVAL - (mileage % OIL_FILTER_INTERVAL)) * factor));
      const brakeFluidKmLeft = Math.max(200, Math.round((BRAKE_FLUID_INTERVAL - (mileage % BRAKE_FLUID_INTERVAL)) * factor));
      const wiringKmLeft = Math.max(500, Math.round((WIRING_INTERVAL - (mileage % WIRING_INTERVAL)) * factor));

      const getSeverity = (kmLeft: number, interval: number) => {
        const pct = kmLeft / interval;
        if (pct < 0.15) return "critical";
        if (pct < 0.35) return "warning";
        return "ok";
      };

      result.push({
        vehicleId,
        plate,
        brand: v.brand,
        model: v.model,
        mileage,
        lastMaintenance: v.last_maintenance,
        failureProbability: Math.min(99, Math.max(1, probability)),
        parts: [
          {
            name: "Filtros de Óleo/Ar",
            kmUntilChange: oilFilterKmLeft,
            severity: getSeverity(oilFilterKmLeft, OIL_FILTER_INTERVAL),
            intervalKm: OIL_FILTER_INTERVAL,
          },
          {
            name: "Fluido de Freio",
            kmUntilChange: brakeFluidKmLeft,
            severity: getSeverity(brakeFluidKmLeft, BRAKE_FLUID_INTERVAL),
            intervalKm: BRAKE_FLUID_INTERVAL,
          },
          {
            name: "Fiação Elétrica",
            kmUntilChange: wiringKmLeft,
            severity: getSeverity(wiringKmLeft, WIRING_INTERVAL),
            intervalKm: WIRING_INTERVAL,
          },
        ],
      });
    }

    return result;
  }

  async getConsumptionByModel() {
    return query<{ brand: string; model: string; avg_km_per_l: string; total_km: string; vehicle_count: string }>(
      `SELECT v.brand, v.model,
              CAST(COALESCE(AVG(v.avg_consumption), 0) AS CHAR) as avg_km_per_l,
              CAST(COALESCE(SUM(t.distance_km), 0) AS CHAR) as total_km,
              CAST(COUNT(DISTINCT v.id) AS CHAR) as vehicle_count
       FROM vehicles v
       LEFT JOIN fuel_records f ON f.vehicle_id = v.id
       LEFT JOIN travels t ON t.vehicle_id = v.id AND t.status = 'completed'
       GROUP BY v.brand, v.model
       ORDER BY avg_km_per_l DESC`
    ).then((rows) =>
      rows.map((r) => ({
        brand: r.brand,
        model: r.model,
        avgKmPerL: Math.round(parseFloat(r.avg_km_per_l) * 100) / 100,
        totalKm: parseFloat(r.total_km),
        vehicleCount: parseInt(r.vehicle_count),
      }))
    );
  }
}

export const intelligenceService = new IntelligenceService();
