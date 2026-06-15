import { Router } from "express";
import { marketplaceController } from "../controllers/marketplace.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);
router.get("/", (req, res) => marketplaceController.list(req, res));

export default router;
