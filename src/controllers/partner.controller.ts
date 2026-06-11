import { Request, Response } from "express";
import { partnerService } from "../services/partner.service";
import { sendError } from "../utils/errors";

export class PartnerController {
  async get(req: Request, res: Response) {
    const partner = await partnerService.findById(req.params.id);
    if (!partner) return sendError(res, 404, "Parceiro não encontrado");
    const [images, messages] = await Promise.all([
      partnerService.findImages(req.params.id),
      partnerService.getMessages(req.params.id),
    ]);
    return res.json({ partner, images, messages });
  }

  async messages(req: Request, res: Response) {
    try {
      const msg = await partnerService.sendMessage(req.params.id, {
        sender_name: req.body.sender_name || req.user?.email || "Administrador",
        sender_role: req.user?.role,
        message: req.body.message,
      });
      return res.status(201).json(msg);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao enviar mensagem");
    }
  }

  async list(_req: Request, res: Response) {
    const [partners, stats, tickets] = await Promise.all([
      partnerService.findAll(),
      partnerService.getStats(),
      partnerService.findTickets(),
    ]);
    return res.json({ partners, stats, tickets });
  }

  async create(req: Request, res: Response) {
    try {
      const partner = await partnerService.create(req.body);
      return res.status(201).json(partner);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao cadastrar parceiro");
    }
  }

  async createTicket(req: Request, res: Response) {
    try {
      const ticket = await partnerService.createTicket(req.body);
      return res.status(201).json(ticket);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao abrir chamado");
    }
  }
}

export const partnerController = new PartnerController();
