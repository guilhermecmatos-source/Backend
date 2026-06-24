import { Request, Response } from "express";
import { movimentacaoService } from "../services/movimentacao.service";
import { ruvService } from "../services/ruv.service";
import { sendError } from "../utils/errors";

function mapRuvToFrontend(ruv: any) {
  if (!ruv) return ruv;
  let status = ruv.status;
  if (status === "pendente") status = "pending";
  else if (status === "aprovado") status = "approved";
  else if (status === "rejeitado") status = "rejected";
  else if (status === "em_andamento") status = "in_transit";
  else if (status === "concluido") status = "completed";

  return {
    ...ruv,
    service: ruv.purpose,
    status: status,
  };
}

export class MovimentacaoController {
  async registrarSaida(req: Request, res: Response) {
    try {
      const { requisicao_id, km_inicial } = req.body;

      if (!requisicao_id) {
        return sendError(res, 400, "O campo requisicao_id é obrigatório.");
      }

      if (km_inicial === undefined || km_inicial === null || isNaN(Number(km_inicial))) {
        return sendError(res, 400, "O campo km_inicial é obrigatório e deve ser um número.");
      }

      const kmInicialNum = Number(km_inicial);
      if (kmInicialNum < 0) {
        return sendError(res, 400, "O km_inicial não pode ser negativo.");
      }

      // Verifica se a RUV existe
      const ruv = await ruvService.findById(requisicao_id);
      if (!ruv) {
        return sendError(res, 404, "Requisição de veículo (RUV) não encontrada.");
      }

      // Verifica se a RUV está aprovada
      if (ruv.status !== "aprovado") {
        return sendError(res, 400, `A movimentação só pode ser iniciada se a RUV estiver aprovada. Status atual: ${ruv.status}`);
      }

      // Verifica se já existe uma movimentação para essa RUV
      const movimentacaoExistente = await movimentacaoService.findByRequisicaoId(requisicao_id);
      if (movimentacaoExistente) {
        return sendError(res, 400, "Já existe uma movimentação registrada para esta RUV.");
      }

      // Registra a saída
      const movimentacao = await movimentacaoService.registrarSaida(requisicao_id, kmInicialNum);

      // Atualiza o status da RUV para 'em_andamento'
      await ruvService.updateStatus(
        requisicao_id,
        "em_andamento",
        req.user!.userId,
        req.user?.email
      );

      return res.status(201).json(movimentacao);
    } catch (err) {
      console.error("[movimentacaoController.registrarSaida]", err);
      return sendError(res, 500, "Erro ao registrar saída de veículo.");
    }
  }

  async registrarRetorno(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { km_final } = req.body;

      if (km_final === undefined || km_final === null || isNaN(Number(km_final))) {
        return sendError(res, 400, "O campo km_final é obrigatório e deve ser um número.");
      }

      const kmFinalNum = Number(km_final);

      // Busca a movimentação pelo ID
      const movimentacao = await movimentacaoService.findById(id);
      if (!movimentacao) {
        return sendError(res, 404, "Movimentação não encontrada.");
      }

      // Verifica se a movimentação já foi finalizada
      if (movimentacao.km_final !== null && movimentacao.km_final !== undefined) {
        return sendError(res, 400, "Esta movimentação já foi concluída.");
      }

      // Valida se km_final > km_inicial
      if (kmFinalNum <= Number(movimentacao.km_inicial)) {
        return sendError(
          res,
          400,
          `O KM final (${kmFinalNum}) deve ser maior que o KM inicial (${movimentacao.km_inicial}).`
        );
      }

      // Registra o retorno
      const movimentacaoAtualizada = await movimentacaoService.registrarRetorno(id, kmFinalNum);

      // Atualiza o status da RUV para 'concluido'
      await ruvService.updateStatus(
        movimentacao.requisicao_id,
        "concluido",
        req.user!.userId,
        req.user?.email
      );

      return res.json(movimentacaoAtualizada);
    } catch (err) {
      console.error("[movimentacaoController.registrarRetorno]", err);
      return sendError(res, 500, "Erro ao registrar retorno de veículo.");
    }
  }

  async listarRequisicoes(req: Request, res: Response) {
    try {
      const status = req.query.status as string | undefined;
      let dbStatus: string | undefined = undefined;

      if (status === "pending") dbStatus = "pendente";
      else if (status === "approved") dbStatus = "aprovado";
      else if (status === "rejected") dbStatus = "rejeitado";
      else if (status === "in_transit") dbStatus = "em_andamento";
      else if (status === "completed") dbStatus = "concluido";
      else dbStatus = status;

      const ruvs = await ruvService.findAll(dbStatus);
      return res.json(ruvs.map(mapRuvToFrontend));
    } catch (err) {
      console.error("[movimentacaoController.listarRequisicoes]", err);
      return sendError(res, 500, "Erro ao listar requisições.");
    }
  }

  async obterDetalhesRequisicao(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const ruv = await ruvService.findById(id);
      if (!ruv) {
        return sendError(res, 404, "Requisição não encontrada.");
      }

      const movimentacao = await movimentacaoService.findByRequisicaoId(id);

      const ruvMapped = mapRuvToFrontend(ruv);
      return res.json({
        ...ruvMapped,
        movimentacao: movimentacao || null,
      });
    } catch (err) {
      console.error("[movimentacaoController.obterDetalhesRequisicao]", err);
      return sendError(res, 500, "Erro ao obter detalhes da requisição.");
    }
  }

  async listarMovimentacoes(req: Request, res: Response) {
    try {
      const movimentacoes = await movimentacaoService.findAll();
      return res.json(movimentacoes);
    } catch (err) {
      console.error("[movimentacaoController.listarMovimentacoes]", err);
      return sendError(res, 500, "Erro ao listar movimentações.");
    }
  }
}

export const movimentacaoController = new MovimentacaoController();
