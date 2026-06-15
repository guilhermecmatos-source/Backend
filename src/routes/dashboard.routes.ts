import { Router } from "express";
import { dashboardController } from "../controllers/dashboard.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authenticate, (req, res) => dashboardController.index(req, res));
router.get("/analytics", authenticate, (req, res) => dashboardController.analytics(req, res));

export default router;
