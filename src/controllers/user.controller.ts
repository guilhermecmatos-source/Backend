import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { auditService } from "../services/audit.service";
import { sendError } from "../utils/errors";

export class UserController {
  async list(req: Request, res: Response) {
    try {
      const status = req.query.status as string | undefined;
      return res.json(await userService.findAll(status));
    } catch (err) {
      console.error("[user.list]", err);
      return sendError(res, 500, "Erro ao listar usuários");
    }
  }

  async get(req: Request, res: Response) {
    try {
      const user = await userService.findById(req.params.id);
      if (!user) return sendError(res, 404, "Usuário não encontrado");
      return res.json(user);
    } catch (err) {
      console.error("[user.get]", err);
      return sendError(res, 500, "Erro ao obter usuário");
    }
  }

  async create(req: Request, res: Response) {
    try {
      const user = await userService.create(req.body);
      await auditService.log({
        entityType: "user",
        entityId: user.id,
        action: "create",
        userId: req.user?.userId,
        userEmail: req.user?.email,
      });
      return res.status(201).json(user);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao criar usuário");
    }
  }

  async update(req: Request, res: Response) {
    try {
      const user = await userService.update(req.params.id, req.body);
      if (!user) return sendError(res, 404, "Usuário não encontrado");
      await auditService.log({
        entityType: "user",
        entityId: user.id,
        action: "update",
        userId: req.user?.userId,
        userEmail: req.user?.email,
      });
      return res.json(user);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao atualizar");
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const deleted = await userService.delete(req.params.id);
      if (!deleted) return sendError(res, 404, "Usuário não encontrado");
      await auditService.log({
        entityType: "user",
        entityId: req.params.id,
        action: "delete",
        userId: req.user?.userId,
        userEmail: req.user?.email,
      });
      return res.status(204).send();
    } catch (err) {
      console.error("[user.delete]", err);
      return sendError(res, 500, "Erro ao excluir usuário");
    }
  }

  async approve(req: Request, res: Response) {
    try {
      const user = await userService.approve(req.params.id);
      if (!user) return sendError(res, 404, "Usuário não encontrado");
      await auditService.log({
        entityType: "user",
        entityId: req.params.id,
        action: "update",
        userId: req.user?.userId,
        userEmail: req.user?.email,
        details: "status=approved",
      });
      return res.json(user);
    } catch (err) {
      console.error("[user.approve]", err);
      return sendError(res, 500, "Erro ao aprovar usuário");
    }
  }

  async reject(req: Request, res: Response) {
    try {
      const success = await userService.reject(req.params.id);
      if (!success) return sendError(res, 404, "Usuário não encontrado");
      await auditService.log({
        entityType: "user",
        entityId: req.params.id,
        action: "delete",
        userId: req.user?.userId,
        userEmail: req.user?.email,
        details: "status=rejected",
      });
      return res.status(204).send();
    } catch (err) {
      console.error("[user.reject]", err);
      return sendError(res, 500, "Erro ao rejeitar usuário");
    }
  }
}

export const userController = new UserController();
