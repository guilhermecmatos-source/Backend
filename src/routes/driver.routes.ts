import { Router } from "express";
import { driverController } from "../controllers/driver.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", (req, res) => driverController.list(req, res));
router.get("/:id/score", (req, res) => driverController.score(req, res));
router.get("/:id", (req, res) => driverController.get(req, res));
router.post("/", authorize("administrador", "gestor", "admin", "attendant"), (req, res) =>
  driverController.create(req, res)
);
router.put("/:id", authorize("administrador", "gestor", "admin", "attendant"), (req, res) =>
  driverController.update(req, res)
);
router.delete("/:id", authorize("admin"), (req, res) => driverController.delete(req, res));

export default router;
