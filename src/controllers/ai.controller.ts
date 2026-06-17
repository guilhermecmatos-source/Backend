import { Request, Response } from "express";
import { aiService } from "../services/ai.service";
import { sendError } from "../utils/errors";

export class AiController {
  async chat(req: Request, res: Response) {
    try {
      const { messages, activeModule, vehicleContext } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return sendError(res, 400, "O histórico de mensagens é obrigatório e deve ser um array não vazio.");
      }

      const responseText = await aiService.generateChatResponse(messages, activeModule, vehicleContext);
      return res.json({ response: responseText, reply: responseText });
    } catch (e) {
      console.error("[AiController.chat]", e);
      return sendError(res, 500, e instanceof Error ? e.message : "Erro interno no chat com IA");
    }
  }
}

export const aiController = new AiController();
