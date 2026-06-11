import { Router } from "express";
import { uploadController } from "../controllers/upload.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

router.use(authenticate);
router.post(
  "/",
  authorize("administrador", "gestor", "admin", "attendant", "solicitante"),
  upload.single("file"),
  (req, res) => uploadController.uploadFile(req, res)
);

export default router;
