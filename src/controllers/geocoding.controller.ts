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

  async routePoints(req: Request, res: Response) {
    const origin = String(req.query.origin || "").toLowerCase().trim();
    const destination = String(req.query.destination || "").toLowerCase().trim();

    const palmasToGurupi = [
      { lat: -10.184, lng: -48.333, name: "Palmas" },
      { lat: -10.420, lng: -48.360, name: "Porto Nacional - Entrada" },
      { lat: -10.708, lng: -48.413, name: "Porto Nacional" },
      { lat: -11.144, lng: -48.167, name: "Silvanópolis" },
      { lat: -11.432, lng: -48.125, name: "Santa Rosa do Tocantins" },
      { lat: -11.512, lng: -48.932, name: "Aliança do Tocantins" },
      { lat: -11.729, lng: -49.068, name: "Gurupi" }
    ];

    const palmasToAraguaina = [
      { lat: -10.184, lng: -48.333, name: "Palmas" },
      { lat: -9.721, lng: -48.396, name: "Miracema do Tocantins" },
      { lat: -9.531, lng: -48.590, name: "Miranorte" },
      { lat: -8.831, lng: -48.510, name: "Guaraí" },
      { lat: -8.058, lng: -48.476, name: "Colinas do Tocantins" },
      { lat: -7.190, lng: -48.208, name: "Araguaína" }
    ];

    let points = palmasToGurupi;

    const hasPalmas = origin.includes("palmas") || destination.includes("palmas");
    const hasGurupi = origin.includes("gurupi") || destination.includes("gurupi");
    const hasAraguaina = origin.includes("araguaína") || origin.includes("araguaina") || destination.includes("araguaína") || destination.includes("araguaina");

    if (hasPalmas && hasAraguaina) {
      points = palmasToAraguaina;
    } else if (hasPalmas && hasGurupi) {
      points = palmasToGurupi;
    } else if (hasGurupi && hasAraguaina) {
      points = [...palmasToGurupi].reverse().concat(palmasToAraguaina.slice(1));
    }

    const isReverse = 
      (origin.includes("gurupi") && destination.includes("palmas")) ||
      (origin.includes("araguaína") && destination.includes("palmas")) ||
      (origin.includes("araguaina") && destination.includes("palmas"));
      
    if (isReverse) {
      points = [...points].reverse();
    }

    return res.json({
      origin,
      destination,
      pointsCount: points.length,
      points
    });
  }
}

export const geocodingController = new GeocodingController();
