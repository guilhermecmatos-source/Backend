import { Router } from "express";
import { geocodingController } from "../controllers/geocoding.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);
router.get("/places", (req, res) => geocodingController.places(req, res));
router.get("/distance", (req, res) => geocodingController.distance(req, res));
router.get("/routes/points", (req, res) => geocodingController.routePoints(req, res));

export default router;
