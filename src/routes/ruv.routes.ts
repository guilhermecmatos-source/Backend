import { Router } from "express";
import { ruvController } from "../controllers/ruv.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", (req, res) => ruvController.list(req, res));
router.get("/:id", (req, res) => ruvController.get(req, res));
router.post("/", authorize("solicitante", "gestor", "administrador", "admin", "client"), (req, res) =>
  ruvController.create(req, res)
);
router.patch("/:id/approve", authorize("gestor", "administrador", "admin", "attendant"), (req, res) =>
  ruvController.approve(req, res)
);
router.patch("/:id/reject", authorize("gestor", "administrador", "admin", "attendant"), (req, res) =>
  ruvController.reject(req, res)
);

export default router;
