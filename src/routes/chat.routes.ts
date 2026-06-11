import { Router } from "express";
import { chatController } from "../controllers/chat.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/messages/:otherUserId", (req, res) => chatController.listMessages(req, res));
router.post("/messages", (req, res) => chatController.sendMessage(req, res));
router.get("/partners", (req, res) => chatController.listPartners(req, res));

export default router;
