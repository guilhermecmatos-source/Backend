import { Router } from "express";
import { maintenanceController } from "../controllers/maintenance.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", (req, res) => maintenanceController.list(req, res));
router.get("/alerts", (req, res) => maintenanceController.alerts(req, res));
router.post("/", authorize("admin", "attendant"), (req, res) => maintenanceController.create(req, res));
router.patch("/:id/complete", authorize("admin", "attendant"), (req, res) => maintenanceController.complete(req, res));

export default router;
