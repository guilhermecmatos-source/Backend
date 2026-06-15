import { Request, Response } from "express";
import { query } from "../database/connection";
import { sendError } from "../utils/errors";

// Tabela de preços base por tipo de veículo (R$/dia)
const PRICE_TABLE: Record<string, number> = {
  caminhao: 350,
  carreta: 500,
  van: 180,
  utilitario: 130,
  carro: 90,
  default: 200,
};

function inferPricePerDay(brand: string, model: string): number {
  const term = `${brand} ${model}`.toLowerCase();
  if (term.includes("scania") || term.includes("volvo") || term.includes("daf")) return PRICE_TABLE.carreta;
  if (term.includes("mercedes") || term.includes("iveco") || term.includes("man")) return PRICE_TABLE.caminhao;
  if (term.includes("sprinter") || term.includes("master") || term.includes("transit")) return PRICE_TABLE.van;
  if (term.includes("hilux") || term.includes("ranger") || term.includes("s10")) return PRICE_TABLE.utilitario;
  return PRICE_TABLE.default;
}

export class MarketplaceController {
  async list(_req: Request, res: Response) {
    try {
      const vehicles = await query<{
        id: string;
        plate: string;
        brand: string;
        model: string;
        year: string;
        mileage: string;
        avg_consumption: string | null;
        autonomy_km: string | null;
        active_travel: string;
      }>(
        `SELECT v.id, v.plate, v.brand, v.model,
                CAST(v.year AS CHAR) as year,
                CAST(v.mileage AS CHAR) as mileage,
                CAST(v.avg_consumption AS CHAR) as avg_consumption,
                CAST(v.autonomy_km AS CHAR) as autonomy_km,
                CAST(COUNT(t.id) AS CHAR) as active_travel
         FROM vehicles v
         LEFT JOIN travels t ON t.vehicle_id = v.id AND t.status IN ('scheduled', 'in_progress')
         WHERE v.status = 'active'
         GROUP BY v.id
         HAVING active_travel = '0'
         ORDER BY v.brand, v.model`
      );

      const items = vehicles.map((v) => {
        const pricePerDay = inferPricePerDay(v.brand, v.model);
        return {
          id: v.id,
          plate: v.plate,
          brand: v.brand,
          model: v.model,
          year: parseInt(v.year),
          mileage: parseFloat(v.mileage),
          avgConsumption: v.avg_consumption ? parseFloat(v.avg_consumption) : null,
          autonomyKm: v.autonomy_km ? parseFloat(v.autonomy_km) : null,
          pricePerDay,
          available: true,
          category: `${v.brand} ${v.model}`,
        };
      });

      return res.json(items);
    } catch (err) {
      console.error("[marketplace.list]", err);
      return sendError(res, 500, "Erro ao listar marketplace de veículos");
    }
  }
}

export const marketplaceController = new MarketplaceController();
