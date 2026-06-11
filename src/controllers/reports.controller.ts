import { Request, Response } from "express";
import { reportsService } from "../services/reports.service";
import { sendError } from "../utils/errors";

export class ReportsController {
  async summary(req: Request, res: Response) {
    try {
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      return res.json(await reportsService.getSummary(dateFrom, dateTo));
    } catch (err) {
      console.error("[reports.summary]", err);
      return sendError(res, 500, "Erro ao carregar resumo de relatórios");
    }
  }
}

export const reportsController = new ReportsController();
