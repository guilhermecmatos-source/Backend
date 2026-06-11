import { Router } from "express";
import { vehicleController } from "../controllers/vehicle.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

const managers = ["administrador", "gestor", "admin", "attendant"] as const;

router.get("/", (req, res) => vehicleController.list(req, res));
router.get("/:id/fuel-history", (req, res) => vehicleController.fuelHistory(req, res));
router.get("/:id/maintenance-history", (req, res) => vehicleController.maintenanceHistory(req, res));
router.get("/:id", (req, res) => vehicleController.get(req, res));
router.post("/", authorize(...managers), (req, res) => vehicleController.create(req, res));
router.put("/:id", authorize(...managers), (req, res) => vehicleController.update(req, res));
router.delete("/:id", authorize("administrador", "admin"), (req, res) => vehicleController.delete(req, res));

export default router;
