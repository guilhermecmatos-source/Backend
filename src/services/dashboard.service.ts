import { query } from "../database/connection";
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
    const [vehicles, drivers, travels, fuel, maintenance] = await Promise.all([
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
}

export const dashboardService = new DashboardService();
