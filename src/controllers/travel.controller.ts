import { Request, Response } from "express";
import { travelService } from "../services/travel.service";
import { auditService } from "../services/audit.service";
import { sendError } from "../utils/errors";

export class TravelController {
  async list(req: Request, res: Response) {
    const search = req.query.search as string | undefined;
    return res.json(await travelService.findAll(search));
  }

  async carpool(_req: Request, res: Response) {
    return res.json(await travelService.findCarpoolMatches());
  }

  async get(req: Request, res: Response) {
    const travel = await travelService.findById(req.params.id);
    if (!travel) return sendError(res, 404, "Viagem não encontrada");
    return res.json(travel);
  }

  async create(req: Request, res: Response) {
    const {
      vehicle_id,
      driver_id,
      origin,
      destination,
      distance_km,
      fuel_consumption,
      km_start,
      km_end,
      estimated_duration_min,
      cost,
      checklist_departure,
      checklist_arrival,
    } = req.body;
    if (!vehicle_id || !driver_id || !origin || !destination) {
      return sendError(res, 400, "Veículo, motorista, origem e destino são obrigatórios");
    }
    try {
      const travel = await travelService.create({
        vehicle_id,
        driver_id,
        origin,
        destination,
        distance_km,
        fuel_consumption,
        km_start,
        km_end,
        estimated_duration_min,
        cost,
        checklist_departure,
        checklist_arrival,
      });
      if (travel) {
        await auditService.log({
          entityType: "travel",
          entityId: travel.id,
          action: "create",
          userId: req.user?.userId,
          userEmail: req.user?.email,
        });
      }
      return res.status(201).json(travel);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao criar viagem");
    }
  }

  async update(req: Request, res: Response) {
    try {
      const travel = await travelService.update(req.params.id, req.body);
      if (!travel) return sendError(res, 404, "Viagem não encontrada");
      await auditService.log({
        entityType: "travel",
        entityId: travel.id,
        action: "update",
        userId: req.user?.userId,
        userEmail: req.user?.email,
      });
      return res.json(travel);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao atualizar");
    }
  }

  async delete(req: Request, res: Response) {
    const deleted = await travelService.delete(req.params.id);
    if (!deleted) return sendError(res, 404, "Viagem não encontrada");
    await auditService.log({
      entityType: "travel",
      entityId: req.params.id,
      action: "delete",
      userId: req.user?.userId,
      userEmail: req.user?.email,
    });
    return res.status(204).send();
  }

  async cancel(req: Request, res: Response) {
    const travel = await travelService.cancel(req.params.id);
    if (!travel) return sendError(res, 404, "Viagem não encontrada ou já concluída");
    return res.json(travel);
  }
}

export const travelController = new TravelController();
