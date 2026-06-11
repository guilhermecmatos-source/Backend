import { Request, Response } from "express";
import { vehicleService } from "../services/vehicle.service";
import { auditService } from "../services/audit.service";
import { sendError } from "../utils/errors";

export class VehicleController {
  async list(_req: Request, res: Response) {
    const vehicles = await vehicleService.findAll();
    return res.json(vehicles);
  }

  async get(req: Request, res: Response) {
    const vehicle = await vehicleService.findById(req.params.id);
    if (!vehicle) return sendError(res, 404, "Veículo não encontrado");
    return res.json(vehicle);
  }

  async fuelHistory(req: Request, res: Response) {
    return res.json(await vehicleService.getFuelHistory(req.params.id));
  }

  async maintenanceHistory(req: Request, res: Response) {
    return res.json(await vehicleService.getMaintenanceHistory(req.params.id));
  }

  async create(req: Request, res: Response) {
    const { plate, brand, model, year, status, mileage, avg_consumption, autonomy_km } = req.body;
    if (!plate || !brand || !model || !year) {
      return sendError(res, 400, "Placa, marca, modelo e ano são obrigatórios");
    }
    try {
      const vehicle = await vehicleService.create({
        plate,
        brand,
        model,
        year,
        status,
        mileage,
        avg_consumption,
        autonomy_km,
      });
      await auditService.log({
        entityType: "vehicle",
        entityId: vehicle.id,
        action: "create",
        userId: req.user?.userId,
        userEmail: req.user?.email,
      });
      return res.status(201).json(vehicle);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao cadastrar");
    }
  }

  async update(req: Request, res: Response) {
    try {
      const vehicle = await vehicleService.update(req.params.id, req.body);
      if (!vehicle) return sendError(res, 404, "Veículo não encontrado");
      await auditService.log({
        entityType: "vehicle",
        entityId: vehicle.id,
        action: "update",
        userId: req.user?.userId,
        userEmail: req.user?.email,
      });
      return res.json(vehicle);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao atualizar");
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const deleted = await vehicleService.delete(req.params.id);
      if (!deleted) return sendError(res, 404, "Veículo não encontrado");
      await auditService.log({
        entityType: "vehicle",
        entityId: req.params.id,
        action: "delete",
        userId: req.user?.userId,
        userEmail: req.user?.email,
      });
      return res.status(204).send();
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao excluir");
    }
  }
}

export const vehicleController = new VehicleController();
