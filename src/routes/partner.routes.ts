import { Router } from "express";
import { partnerController } from "../controllers/partner.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", (req, res) => partnerController.list(req, res));
router.post("/tickets", authorize("administrador", "gestor", "admin", "attendant"), (req, res) =>
  partnerController.createTicket(req, res)
);
router.get("/:id", (req, res) => partnerController.get(req, res));
router.post("/:id/messages", (req, res) => partnerController.messages(req, res));
router.post("/", authorize("administrador", "gestor", "admin", "attendant"), (req, res) =>
  partnerController.create(req, res)
);

export default router;
