import { Request, Response } from "express";
import { ruvService } from "../services/ruv.service";
import { auditService } from "../services/audit.service";
import { sendError } from "../utils/errors";

function mapRuvToFrontend(ruv: any) {
  if (!ruv) return ruv;
  let status = ruv.status;
  if (status === "pendente") status = "pending";
  else if (status === "aprovado") status = "approved";
  else if (status === "rejeitado") status = "rejected";

  return {
    ...ruv,
    service: ruv.purpose,
    status: status,
  };
}

export class RuvController {
  async list(req: Request, res: Response) {
    try {
      const status = req.query.status as string | undefined;
      let dbStatus: string | undefined = undefined;
      if (status === "pending") dbStatus = "pendente";
      else if (status === "approved") dbStatus = "aprovado";
      else if (status === "rejected") dbStatus = "rejeitado";
      else dbStatus = status;

      const items = await ruvService.findAll(dbStatus);
      return res.json(items.map(mapRuvToFrontend));
    } catch (err) {
      console.error("[ruvController.list]", err);
      return sendError(res, 500, "Erro ao carregar solicitações RUV");
    }
  }

  async get(req: Request, res: Response) {
    try {
      const item = await ruvService.findById(req.params.id);
      if (!item) return sendError(res, 404, "Solicitação não encontrada");
      return res.json(mapRuvToFrontend(item));
    } catch (err) {
      console.error("[ruvController.get]", err);
      return sendError(res, 500, "Erro ao carregar solicitação RUV");
    }
  }

  async create(req: Request, res: Response) {
    try {
      const item = await ruvService.create({
        requester_id: req.user!.userId,
        origin: req.body.origin,
        destination: req.body.destination,
        purpose: req.body.purpose || req.body.service,
        passengers: req.body.passengers || req.body.quantidade,
        descricao: req.body.descricao,
        quantidade: req.body.quantidade ? Number(req.body.quantidade) : undefined,
        vehicle_id: req.body.vehicle_id,
        driver_id: req.body.driver_id,
        time_from: req.body.time_from,
        time_to: req.body.time_to,
        vehicle_type: req.body.vehicle_type,
        authorization_ref: req.body.authorization_ref,
        fuel_type: req.body.fuel_type,
        encarregado_signature: req.body.encarregado_signature,
        route_change: req.body.route_change ? 1 : 0,
        alt_destination: req.body.alt_destination,
        alt_objective: req.body.alt_objective,
        alt_date: req.body.alt_date,
        alt_signature: req.body.alt_signature,
        auth_number: req.body.auth_number,
      });
      await auditService.log({
        entityType: "ruv_request",
        entityId: item.id,
        action: "create",
        userId: req.user?.userId,
        userEmail: req.user?.email,
      });
      return res.status(201).json(mapRuvToFrontend(item));
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao criar solicitação");
    }
  }

  async approve(req: Request, res: Response) {
    try {
      const item = await ruvService.approve(
        req.params.id,
        req.user!.userId,
        req.body.justification
      );
      if (!item) return sendError(res, 404, "Solicitação não encontrada");
      await auditService.log({
        entityType: "ruv_request",
        entityId: item.id,
        action: "update",
        userId: req.user?.userId,
        userEmail: req.user?.email,
        details: "aprovado",
      });
      return res.json(mapRuvToFrontend(item));
    } catch (err) {
      console.error("[ruvController.approve]", err);
      return sendError(res, 500, "Erro ao aprovar solicitação RUV");
    }
  }

  async reject(req: Request, res: Response) {
    try {
      const item = await ruvService.reject(
        req.params.id,
        req.user!.userId,
        req.body.justification
      );
      if (!item) return sendError(res, 404, "Solicitação não encontrada");
      await auditService.log({
        entityType: "ruv_request",
        entityId: item.id,
        action: "update",
        userId: req.user?.userId,
        userEmail: req.user?.email,
        details: "rejeitado",
      });
      return res.json(mapRuvToFrontend(item));
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao rejeitar solicitação");
    }
  }
}

export const ruvController = new RuvController();
