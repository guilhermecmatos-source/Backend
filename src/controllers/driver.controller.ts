import { Request, Response } from "express";
import { driverService } from "../services/driver.service";
import { sendError } from "../utils/errors";

export class DriverController {
  async list(_req: Request, res: Response) {
    return res.json(await driverService.findAll());
  }

  async get(req: Request, res: Response) {
    const driver = await driverService.findById(req.params.id);
    if (!driver) return sendError(res, 404, "Motorista não encontrado");
    const images = await driverService.findImages(req.params.id);
    return res.json({ driver, images });
  }

  async create(req: Request, res: Response) {
    const { name, license_number, phone, cpf, rg, cnh_category, cnh_expiry, status, vehicle_id } =
      req.body;
    if (!name || !license_number) {
      return sendError(res, 400, "Nome e CNH são obrigatórios");
    }
    try {
      const driver = await driverService.create({
        name,
        license_number,
        phone,
        cpf,
        rg,
        cnh_category,
        cnh_expiry,
        status,
        vehicle_id,
      });
      return res.status(201).json(driver);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao cadastrar motorista");
    }
  }

  async update(req: Request, res: Response) {
    try {
      const driver = await driverService.update(req.params.id, req.body);
      if (!driver) return sendError(res, 404, "Motorista não encontrado");
      return res.json(driver);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao atualizar");
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const deleted = await driverService.delete(req.params.id);
      if (!deleted) return sendError(res, 404, "Motorista não encontrado");
      return res.status(204).send();
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  async score(req: Request, res: Response) {
    const score = await driverService.refreshScore(req.params.id);
    return res.json({ driverId: req.params.id, score });
  }
}

export const driverController = new DriverController();
