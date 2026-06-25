import { query } from "../database/connection";

const REGIONS = [
  { name: "Palmas", keyword: "Palmas" },
  { name: "Gurupi", keyword: "Gurupi" },
  { name: "Araguaína", keyword: "Araguaína" },
];
import { predictiveService } from "../ai/predictive.service";

export class DashboardService {
  async getPeriodEvolution(dateFrom?: string, dateTo?: string) {
    const from = dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = dateTo || new Date().toISOString().slice(0, 10);

    const travels = await query<{ label: string; count: string }>(
      `SELECT DATE_FORMAT(started_at, '%d/%m') as label, CAST(COUNT(*) AS CHAR) as count
       FROM travels
       WHERE started_at >= $1 AND started_at <= DATE_ADD($2, INTERVAL 1 DAY)
       GROUP BY DATE(started_at)
       ORDER BY DATE(started_at)`,
      [from, to]
    ).catch(() => []);

    const fuel = await query<{ label: string; total: string }>(
      `SELECT DATE_FORMAT(filled_at, '%d/%m') as label, CAST(COALESCE(SUM(cost),0) AS CHAR) as total
       FROM fuel_records
       WHERE filled_at >= $1 AND filled_at <= DATE_ADD($2, INTERVAL 1 DAY)
       GROUP BY DATE(filled_at)
       ORDER BY DATE(filled_at)`,
      [from, to]
    ).catch(() => []);

    const labels = new Set<string>();
    travels.forEach((r) => labels.add(r.label));
    fuel.forEach((r) => labels.add(r.label));
    const sortedLabels = Array.from(labels);

    if (sortedLabels.length === 0) {
      const days = Math.min(7, Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1));
      for (let i = 0; i < days; i++) {
        const d = new Date(from);
        d.setDate(d.getDate() + i);
        sortedLabels.push(d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
      }
    }

    return sortedLabels.map((label) => ({
      label,
      viagens: parseInt(travels.find((t) => t.label === label)?.count ?? "0", 10),
      combustivel: parseFloat(fuel.find((f) => f.label === label)?.total ?? "0"),
    }));
  }

  async getKpis() {
    const [vehicles, drivers, travels, fuel, maintenance, ruvs] = await Promise.all([
      query<{ total: string; active: string }>(
        `SELECT CAST(COUNT(*) AS CHAR) as total,
         CAST(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS CHAR) as active FROM vehicles`
      ).catch(() => [{ total: "0", active: "0" }]),
      query<{ total: string }>("SELECT CAST(COUNT(*) AS CHAR) as total FROM drivers WHERE active = 1")
        .catch(() => [{ total: "0" }]),
      query<{ total: string; completed: string }>(
        `SELECT CAST(COUNT(*) AS CHAR) as total,
         CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS CHAR) as completed FROM travels`
      ).catch(() => [{ total: "0", completed: "0" }]),
      query<{ total_cost: string }>(
        "SELECT CAST(COALESCE(SUM(cost), 0) AS CHAR) as total_cost FROM fuel_records"
      ).catch(() => [{ total_cost: "0" }]),
      query<{ pending: string }>(
        `SELECT CAST(COUNT(*) AS CHAR) as pending FROM maintenances
         WHERE completed_at IS NULL AND scheduled_at <= DATE_ADD(NOW(), INTERVAL 30 DAY)`
      ).catch(() => [{ pending: "0" }]),
      query<{ total: string; approved: string }>(
        `SELECT CAST(COUNT(*) AS CHAR) as total,
         CAST(SUM(CASE WHEN status = 'aprovado' THEN 1 ELSE 0 END) AS CHAR) as approved FROM ruv_requests`
      ).catch(() => [{ total: "0", approved: "0" }]),
    ]);

    return {
      vehicles: {
        total: parseInt(vehicles[0]?.total ?? "0", 10),
        active: parseInt(vehicles[0]?.active ?? "0", 10)
      },
      drivers: parseInt(drivers[0]?.total ?? "0", 10),
      travels: {
        total: parseInt(travels[0]?.total ?? "0", 10),
        completed: parseInt(travels[0]?.completed ?? "0", 10)
      },
      fuelCost: parseFloat(fuel[0]?.total_cost ?? "0"),
      pendingMaintenance: parseInt(maintenance[0]?.pending ?? "0", 10),
      ruv: {
        total: parseInt(ruvs[0]?.total ?? "0", 10),
        approved: parseInt(ruvs[0]?.approved ?? "0", 10)
      }
    };
  }

  async getAlerts() {
    return predictiveService.generateAllAlerts();
  }

  async getRecentVehicles(limit = 5) {
    const parsedLimit = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 5));
    return query(
      `SELECT id, plate, brand, model, status, mileage FROM vehicles ORDER BY updated_at DESC LIMIT ${parsedLimit}`
    );
  }

  async getDemandForecast() {
    return predictiveService.predictLogisticsDemand();
  }

  async getAnalytics() {
    // KPIs por região baseados em viagens
    const regionStats = await Promise.all(
      REGIONS.map(async (region) => {
        const [trips] = await query<{ total: string; completed: string; revenue: string }>(
          `SELECT
             CAST(COUNT(*) AS CHAR) as total,
             CAST(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS CHAR) as completed,
             CAST(COALESCE(SUM(CASE WHEN status='completed' THEN cost ELSE 0 END),0) AS CHAR) as revenue
           FROM travels
           WHERE origin LIKE ? OR destination LIKE ?`,
          [`%${region.keyword}%`, `%${region.keyword}%`]
        ).catch(() => [{ total: "0", completed: "0", revenue: "0" }]);

        const [fuelCost] = await query<{ total: string }>(
          `SELECT CAST(COALESCE(SUM(f.cost),0) AS CHAR) as total
           FROM fuel_records f
           JOIN travels t ON t.vehicle_id = f.vehicle_id
           WHERE t.origin LIKE ? OR t.destination LIKE ?`,
          [`%${region.keyword}%`, `%${region.keyword}%`]
        ).catch(() => [{ total: "0" }]);

        const revenue = parseFloat(trips?.revenue ?? "0");
        const fuel = parseFloat(fuelCost?.total ?? "0");
        const margin = revenue > 0 ? Math.round(((revenue - fuel) / revenue) * 1000) / 10 : 0;

        return {
          region: region.name,
          totalTrips: parseInt(trips?.total ?? "0"),
          completedTrips: parseInt(trips?.completed ?? "0"),
          revenue,
          fuelCost: fuel,
          profitMargin: margin,
        };
      })
    );

    // Faturamento total (contratos + viagens)
    const [contractRevenue] = await query<{ total: string }>(
      `SELECT CAST(COALESCE(SUM(honorarios),0) AS CHAR) as total FROM contracts WHERE status = 'assinado'`
    ).catch(() => [{ total: "0" }]);

    const [tripRevenue] = await query<{ total: string }>(
      `SELECT CAST(COALESCE(SUM(cost),0) AS CHAR) as total FROM travels WHERE status = 'completed'`
    ).catch(() => [{ total: "0" }]);

    const [fuelTotal] = await query<{ total: string }>(
      `SELECT CAST(COALESCE(SUM(cost),0) AS CHAR) as total FROM fuel_records`
    ).catch(() => [{ total: "0" }]);

    const totalRevenue = parseFloat(contractRevenue?.total ?? "0") + parseFloat(tripRevenue?.total ?? "0");
    const totalFuel = parseFloat(fuelTotal?.total ?? "0");
    const globalMargin = totalRevenue > 0 ? Math.round(((totalRevenue - totalFuel) / totalRevenue) * 1000) / 10 : 0;

    // Funil comercial (status de contratos)
    const funnelRows = await query<{ status: string; count: string }>(
      `SELECT status, CAST(COUNT(*) AS CHAR) as count FROM contracts GROUP BY status`
    ).catch(() => []);

    const funnelMap: Record<string, number> = {};
    funnelRows.forEach((r) => { funnelMap[r.status] = parseInt(r.count); });

    const funnel = [
      { stage: "Rascunho",  key: "rascunho",  count: funnelMap["rascunho"] ?? 0 },
      { stage: "Enviado",   key: "enviado",   count: funnelMap["enviado"] ?? 0 },
      { stage: "Assinado",  key: "assinado",  count: funnelMap["assinado"] ?? 0 },
      { stage: "Cancelado", key: "cancelado", count: funnelMap["cancelado"] ?? 0 },
    ];

    // Evolução mensal de receita (últimos 6 meses)
    const revenueEvolution = await query<{ month: string; revenue: string; trips: string }>(
      `SELECT DATE_FORMAT(started_at, '%m/%Y') as month,
              CAST(COALESCE(SUM(cost),0) AS CHAR) as revenue,
              CAST(COUNT(*) AS CHAR) as trips
       FROM travels
       WHERE started_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) AND status = 'completed'
       GROUP BY DATE_FORMAT(started_at, '%m/%Y'), YEAR(started_at), MONTH(started_at)
       ORDER BY YEAR(started_at), MONTH(started_at)`
    ).catch(() => []);

    return {
      regions: regionStats,
      billing: {
        totalRevenue,
        contractRevenue: parseFloat(contractRevenue?.total ?? "0"),
        tripRevenue: parseFloat(tripRevenue?.total ?? "0"),
        totalFuelCost: totalFuel,
        globalProfitMargin: globalMargin,
      },
      funnel,
      revenueEvolution: revenueEvolution.map((r) => ({
        month: r.month,
        revenue: parseFloat(r.revenue),
        trips: parseInt(r.trips),
      })),
    };
  }
}

export const dashboardService = new DashboardService();
