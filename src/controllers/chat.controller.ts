import { Request, Response } from "express";
import { chatService } from "../services/chat.service";
import { sendError } from "../utils/errors";

export class ChatController {
  async listMessages(req: Request, res: Response) {
    try {
      const otherUserId = req.params.otherUserId;
      const currentUserId = req.user!.userId;
      const messages = await chatService.getMessagesBetween(currentUserId, otherUserId);
      return res.json(messages);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao listar mensagens");
    }
  }

  async sendMessage(req: Request, res: Response) {
    try {
      const currentUserId = req.user!.userId;
      const { receiverId, message } = req.body;
      if (!receiverId || !message) {
        return sendError(res, 400, "Destinatário e mensagem são obrigatórios.");
      }
      const chatMessage = await chatService.saveMessage(currentUserId, receiverId, message);
      return res.status(201).json(chatMessage);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao enviar mensagem");
    }
  }

  async listPartners(req: Request, res: Response) {
    try {
      const currentUserId = req.user!.userId;
      const partners = await chatService.getChatPartners(currentUserId);
      return res.json(partners);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao listar contatos");
    }
  }
}

export const chatController = new ChatController();
