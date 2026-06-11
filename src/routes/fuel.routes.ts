import { Router } from "express";
import { fuelController } from "../controllers/fuel.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", (req, res) => fuelController.list(req, res));
router.get("/report", (req, res) => fuelController.report(req, res));
router.get("/patterns/:vehicleId", (req, res) => fuelController.patterns(req, res));
router.post("/", authorize("admin", "attendant"), (req, res) => fuelController.create(req, res));

export default router;
