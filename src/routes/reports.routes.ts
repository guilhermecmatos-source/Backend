import { Router } from "express";
import { reportsController } from "../controllers/reports.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);
router.get("/", (req, res) => reportsController.summary(req, res));

export default router;
