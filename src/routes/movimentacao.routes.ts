import { Router } from "express";
import { movimentacaoController } from "../controllers/movimentacao.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.post("/saida", (req, res) => movimentacaoController.registrarSaida(req, res));
router.put("/retorno/:id", (req, res) => movimentacaoController.registrarRetorno(req, res));
router.get("/", (req, res) => movimentacaoController.listarMovimentacoes(req, res));

export default router;
