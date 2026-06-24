import { Request, Response } from "express";
import { movimentacaoService } from "../services/movimentacao.service";
import { auditService } from "../services/audit.service";
import { sendError } from "../utils/errors";

export class MovimentacaoController {
  /**
   * POST /movimentacoes/saida
   * Body: { requisicao_id: string, km_inicial: number }
   *
   * Registra a saída do veículo. A RUV associada deve existir e estar "aprovado".
   * Ao salvar, o status da RUV é alterado para "Em Trânsito".
   */
  async registrarSaida(req: Request, res: Response) {
    try {
      const { requisicao_id, km_inicial } = req.body;

      // --- Validação de entrada ---
      if (!requisicao_id || String(requisicao_id).trim() === "") {
        return sendError(res, 400, "O campo requisicao_id é obrigatório.");
      }

      const kmInicialNum = Number(km_inicial);
      if (km_inicial === undefined || km_inicial === null || isNaN(kmInicialNum) || kmInicialNum < 0) {
        return sendError(res, 400, "O campo km_inicial é obrigatório e deve ser um número não-negativo.");
      }

      // --- Lógica de negócio ---
      const movimentacao = await movimentacaoService.registrarSaida(
        String(requisicao_id).trim(),
        kmInicialNum
      );

      // --- Auditoria ---
      await auditService.log({
        entityType: "movimentacao",
        entityId: movimentacao.id,
        action: "create",
        userId: req.user?.userId,
        userEmail: req.user?.email,
        details: `Saída registrada — km_inicial: ${kmInicialNum} | requisicao_id: ${requisicao_id}`,
      });

      return res.status(201).json(movimentacao);
    } catch (err) {
      console.error("[movimentacaoController.registrarSaida]", err);
      return sendError(
        res,
        400,
        err instanceof Error ? err.message : "Erro ao registrar saída."
      );
    }
  }

  /**
   * PUT /movimentacoes/retorno/:id
   * Body: { km_final: number }
   *
   * Registra o retorno do veículo. Valida que km_final > km_inicial.
   * Salva data_retorno e muda o status da RUV para "Concluída".
   */
  async registrarRetorno(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { km_final } = req.body;

      // --- Validação de entrada ---
      const kmFinalNum = Number(km_final);
      if (km_final === undefined || km_final === null || isNaN(kmFinalNum) || kmFinalNum < 0) {
        return sendError(res, 400, "O campo km_final é obrigatório e deve ser um número não-negativo.");
      }

      // --- Lógica de negócio ---
      const movimentacao = await movimentacaoService.registrarRetorno(id, kmFinalNum);

      // --- Auditoria ---
      await auditService.log({
        entityType: "movimentacao",
        entityId: movimentacao.id,
        action: "update",
        userId: req.user?.userId,
        userEmail: req.user?.email,
        details: `Retorno registrado — km_final: ${kmFinalNum} | requisicao_id: ${movimentacao.requisicao_id}`,
      });

      return res.json(movimentacao);
    } catch (err) {
      console.error("[movimentacaoController.registrarRetorno]", err);
      return sendError(
        res,
        400,
        err instanceof Error ? err.message : "Erro ao registrar retorno."
      );
    }
  }

  /**
   * GET /movimentacoes
   * Lista todas as movimentações com dados da RUV atrelada.
   */
  async list(_req: Request, res: Response) {
    try {
      const items = await movimentacaoService.findAll();
      return res.json(items);
    } catch (err) {
      console.error("[movimentacaoController.list]", err);
      return sendError(res, 500, "Erro ao listar movimentações.");
    }
  }

  /**
   * GET /movimentacoes/:id
   * Retorna uma movimentação específica.
   */
  async get(req: Request, res: Response) {
    try {
      const item = await movimentacaoService.findById(req.params.id);
      if (!item) return sendError(res, 404, "Movimentação não encontrada.");
      return res.json(item);
    } catch (err) {
      console.error("[movimentacaoController.get]", err);
      return sendError(res, 500, "Erro ao buscar movimentação.");
    }
  }

  /**
   * GET /movimentacoes/ruv/:requisicaoId
   * Retorna as movimentações vinculadas a uma RUV específica.
   */
  async getByRequisicao(req: Request, res: Response) {
    try {
      const items = await movimentacaoService.findByRequisicaoId(req.params.requisicaoId);
      return res.json(items);
    } catch (err) {
      console.error("[movimentacaoController.getByRequisicao]", err);
      return sendError(res, 500, "Erro ao buscar movimentações da RUV.");
    }
  }
}

export const movimentacaoController = new MovimentacaoController();
