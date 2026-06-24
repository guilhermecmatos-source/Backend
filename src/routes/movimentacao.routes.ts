import { Router } from "express";
import { movimentacaoController } from "../controllers/movimentacao.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// Todas as rotas exigem autenticação
router.use(authenticate);

/**
 * GET /api/movimentacoes
 * Lista todas as movimentações (gestores e administradores).
 */
router.get(
  "/",
  authorize("gestor", "administrador", "admin", "attendant"),
  (req, res) => movimentacaoController.list(req, res)
);

/**
 * GET /api/movimentacoes/ruv/:requisicaoId
 * Lista movimentações de uma RUV específica.
 * IMPORTANTE: esta rota deve ficar ANTES de /:id para não ser capturada por ela.
 */
router.get(
  "/ruv/:requisicaoId",
  authorize("motorista", "gestor", "administrador", "admin", "attendant"),
  (req, res) => movimentacaoController.getByRequisicao(req, res)
);

/**
 * GET /api/movimentacoes/:id
 * Detalhe de uma movimentação específica.
 */
router.get(
  "/:id",
  authorize("motorista", "gestor", "administrador", "admin", "attendant"),
  (req, res) => movimentacaoController.get(req, res)
);

/**
 * POST /api/movimentacoes/saida
 * Registra a saída do veículo vinculando a uma RUV aprovada.
 * Body: { requisicao_id, km_inicial }
 */
router.post(
  "/saida",
  authorize("motorista", "gestor", "administrador", "admin", "attendant"),
  (req, res) => movimentacaoController.registrarSaida(req, res)
);

/**
 * PUT /api/movimentacoes/retorno/:id
 * Registra o retorno do veículo, validando km_final > km_inicial.
 * Body: { km_final }
 */
router.put(
  "/retorno/:id",
  authorize("motorista", "gestor", "administrador", "admin", "attendant"),
  (req, res) => movimentacaoController.registrarRetorno(req, res)
);

export default router;
