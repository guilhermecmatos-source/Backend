import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);
router.use(authorize("administrador", "admin"));

router.get("/", (req, res) => userController.list(req, res));
router.get("/:id", (req, res) => userController.get(req, res));
router.post("/", (req, res) => userController.create(req, res));
router.put("/:id", (req, res) => userController.update(req, res));
router.delete("/:id", (req, res) => userController.delete(req, res));
router.patch("/:id/approve", (req, res) => userController.approve(req, res));
router.patch("/:id/reject", (req, res) => userController.reject(req, res));

export default router;
