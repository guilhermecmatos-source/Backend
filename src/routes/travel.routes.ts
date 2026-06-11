import { Router } from "express";
import { travelController } from "../controllers/travel.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

const managers = ["administrador", "gestor", "admin", "attendant"] as const;

router.get("/", (req, res) => travelController.list(req, res));
router.get("/carpool/matches", (req, res) => travelController.carpool(req, res));
router.get("/:id", (req, res) => travelController.get(req, res));
router.post("/", authorize(...managers, "motorista"), (req, res) => travelController.create(req, res));
router.put("/:id", authorize(...managers, "motorista"), (req, res) => travelController.update(req, res));
router.delete("/:id", authorize(...managers), (req, res) => travelController.delete(req, res));
router.patch("/:id/cancel", authorize(...managers), (req, res) => travelController.cancel(req, res));

export default router;
