import { Router } from "express";
import { intelligenceController } from "../controllers/intelligence.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);
router.get("/metrics", (req, res) => intelligenceController.metrics(req, res));
router.get("/discovery", (req, res) => intelligenceController.discovery(req, res));
router.get("/ceo", (req, res) => intelligenceController.ceo(req, res));
router.get("/travels", (req, res) => intelligenceController.travels(req, res));

export default router;
