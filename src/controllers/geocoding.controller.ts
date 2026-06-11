import { Request, Response } from "express";
import { resolveRouteDistance, searchPlaces } from "../services/geocoding.service";
import { sendError } from "../utils/errors";

export class GeocodingController {
  async places(req: Request, res: Response) {
    const q = String(req.query.q || "");
    if (!q.trim()) return sendError(res, 400, "q is required");
    try {
      const places = await searchPlaces(q);
      return res.json(places);
    } catch (err) {
      console.error("[geocoding/places]", err);
      return sendError(res, 500, "Erro ao buscar endereços");
    }
  }

  async distance(req: Request, res: Response) {
    const origin = String(req.query.origin || "");
    const destination = String(req.query.destination || "");
    if (!origin || !destination) {
      return sendError(res, 400, "origin and destination are required");
    }
    try {
      const result = await resolveRouteDistance(origin, destination);
      return res.json(result);
    } catch (err) {
      console.error("[geocoding]", err);
      return sendError(res, 500, "Erro ao calcular distância");
    }
  }
}

export const geocodingController = new GeocodingController();
