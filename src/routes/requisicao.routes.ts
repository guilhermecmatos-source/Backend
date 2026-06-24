import { Router } from "express";
import { movimentacaoController } from "../controllers/movimentacao.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", (req, res) => movimentacaoController.listarRequisicoes(req, res));
router.get("/:id", (req, res) => movimentacaoController.obterDetalhesRequisicao(req, res));

export default router;
