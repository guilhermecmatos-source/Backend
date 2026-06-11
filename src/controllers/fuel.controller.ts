import { Request, Response } from "express";
import { fuelService } from "../services/fuel.service";
import { sendError } from "../utils/errors";

export class FuelController {
  async list(_req: Request, res: Response) {
    return res.json(await fuelService.findAll());
  }

  async create(req: Request, res: Response) {
    const { vehicle_id, liters, cost, mileage_at_fill, station, filled_at, receipt_url } = req.body;
    if (!vehicle_id || !liters || !cost || mileage_at_fill === undefined) {
      return sendError(res, 400, "vehicle_id, liters, cost and mileage_at_fill are required");
    }
    const record = await fuelService.create({ vehicle_id, liters, cost, mileage_at_fill, station, filled_at, receipt_url });
    return res.status(201).json(record);
  }

  async report(req: Request, res: Response) {
    const report = await fuelService.getReport(req.query.vehicleId as string | undefined);
    return res.json(report);
  }

  async patterns(req: Request, res: Response) {
    const alerts = await fuelService.detectPatterns(req.params.vehicleId);
    return res.json(alerts);
  }
}

export const fuelController = new FuelController();
