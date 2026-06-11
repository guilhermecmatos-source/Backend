import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.post("/login", (req, res) => authController.login(req, res));
router.post("/register", (req, res) => authController.register(req, res));
router.post("/logout", authenticate, (req, res) => authController.logout(req, res));
router.get("/me", authenticate, (req, res) => authController.me(req, res));
router.post(
  "/attendants",
  authenticate,
  authorize("admin"),
  (req, res) => authController.createAttendant(req, res)
);

export default router;
