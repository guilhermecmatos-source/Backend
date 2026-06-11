import { Request, Response } from "express";
import { dashboardService } from "../services/dashboard.service";
import { sendError } from "../utils/errors";

export class DashboardController {
  async index(req: Request, res: Response) {
    try {
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const [kpis, alerts, vehicles, forecast, evolution] = await Promise.all([
        dashboardService.getKpis(),
        dashboardService.getAlerts(),
        dashboardService.getRecentVehicles(),
        dashboardService.getDemandForecast(),
        dashboardService.getPeriodEvolution(dateFrom, dateTo),
      ]);
      return res.json({ kpis, alerts, vehicles, forecast, evolution });
    } catch (err) {
      console.error("[dashboard]", err);
      return sendError(res, 500, "Erro ao carregar dashboard");
    }
  }
}

export const dashboardController = new DashboardController();
