import { Router } from "express";
import { telemetryController } from "../controllers/telemetry.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);
router.get("/alerts", (req, res) => telemetryController.alerts(req, res));
router.get("/alerts/history", (req, res) => telemetryController.listAlerts(req, res));
router.post("/alerts/simulate", (req, res) => telemetryController.createAlert(req, res));

export default router;
