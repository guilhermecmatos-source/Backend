import { Request, Response } from "express";
import { maintenanceService } from "../services/maintenance.service";
import { sendError } from "../utils/errors";

export class MaintenanceController {
  async list(_req: Request, res: Response) {
    return res.json(await maintenanceService.findAll());
  }

  async create(req: Request, res: Response) {
    const { vehicle_id, type, description, cost, scheduled_at } = req.body;
    if (!vehicle_id || !type || !description || !scheduled_at) {
      return sendError(res, 400, "vehicle_id, type, description and scheduled_at are required");
    }
    const maintenance = await maintenanceService.create({ vehicle_id, type, description, cost, scheduled_at });
    return res.status(201).json(maintenance);
  }

  async complete(req: Request, res: Response) {
    const maintenance = await maintenanceService.complete(req.params.id);
    if (!maintenance) return sendError(res, 404, "Maintenance not found");
    return res.json(maintenance);
  }

  async alerts(_req: Request, res: Response) {
    const result = await maintenanceService.getAlerts();
    return res.json(result);
  }
}

export const maintenanceController = new MaintenanceController();
