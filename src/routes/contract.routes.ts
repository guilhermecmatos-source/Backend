import { Router } from "express";
import { contractController } from "../controllers/contract.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/templates", (req, res) => contractController.templates(req, res));
router.post("/preview", (req, res) => contractController.preview(req, res));
router.get("/", (req, res) => contractController.list(req, res));
router.get("/:id", (req, res) => contractController.get(req, res));
router.post("/", authorize("administrador", "gestor", "admin"), (req, res) =>
  contractController.create(req, res)
);
router.put("/:id", authorize("administrador", "gestor", "admin"), (req, res) =>
  contractController.update(req, res)
);
router.post("/:id/send", authorize("administrador", "gestor", "admin"), (req, res) =>
  contractController.send(req, res)
);
router.post("/:id/sign", authorize("administrador", "gestor", "admin"), (req, res) =>
  contractController.sign(req, res)
);
router.post("/:id/cancel", authorize("administrador", "gestor", "admin"), (req, res) =>
  contractController.cancel(req, res)
);

export default router;
