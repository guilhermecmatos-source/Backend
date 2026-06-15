import { Router } from "express";
import { intelligenceController } from "../controllers/intelligence.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);
router.get("/metrics", (req, res) => intelligenceController.metrics(req, res));
router.get("/discovery", (req, res) => intelligenceController.discovery(req, res));
router.get("/ceo", (req, res) => intelligenceController.ceo(req, res));
router.get("/travels", (req, res) => intelligenceController.travels(req, res));
router.get("/driver-scores", (req, res) => intelligenceController.driverScores(req, res));
router.get("/predictive-parts", (req, res) => intelligenceController.predictiveParts(req, res));
router.get("/consumption-by-model", (req, res) => intelligenceController.consumptionByModel(req, res));

export default router;
