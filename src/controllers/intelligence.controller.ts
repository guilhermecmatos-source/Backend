import { Request, Response } from "express";
import { intelligenceService } from "../services/intelligence.service";
import { sendError } from "../utils/errors";

export class IntelligenceController {
  async metrics(_req: Request, res: Response) {
    try {
      return res.json(await intelligenceService.getMetrics());
    } catch (err) {
      console.error("[intelligence.metrics]", err);
      return sendError(res, 500, "Erro ao carregar métricas de inteligência");
    }
  }

  async discovery(_req: Request, res: Response) {
    try {
      return res.json(await intelligenceService.getDiscovery());
    } catch (err) {
      console.error("[intelligence.discovery]", err);
      return sendError(res, 500, "Erro ao carregar descobertas de inteligência");
    }
  }

  async ceo(_req: Request, res: Response) {
    try {
      return res.json(await intelligenceService.getCeoInsights());
    } catch (err) {
      console.error("[intelligence.ceo]", err);
      return sendError(res, 500, "Erro ao carregar insights do CEO");
    }
  }

  async travels(_req: Request, res: Response) {
    try {
      return res.json(await intelligenceService.getRecentTravels(15));
    } catch (err) {
      console.error("[intelligence.travels]", err);
      return sendError(res, 500, "Erro ao obter viagens recentes");
    }
  }
}

export const intelligenceController = new IntelligenceController();
