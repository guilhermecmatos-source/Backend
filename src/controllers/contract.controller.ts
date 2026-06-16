import { Request, Response } from "express";
import { contractService } from "../services/contract.service";
import { query } from "../database/connection";
import { sendError } from "../utils/errors";
import { z } from "zod";

const createContractSchema = z.object({
  title: z.string({ message: "O título é obrigatório" }).min(3, "O título deve ter pelo menos 3 caracteres"),
  area: z.string({ message: "A área é obrigatória" }).min(2, "A área é obrigatória"),
  template_key: z.string({ message: "A chave do template é obrigatória" }).min(1, "A chave do template é obrigatória"),
  client_name: z.string({ message: "O nome do cliente é obrigatório" }).min(3, "O nome do cliente deve ter pelo menos 3 caracteres"),
  content: z.string({ message: "O conteúdo é obrigatório" }).min(10, "O conteúdo deve ter pelo menos 10 caracteres"),
  client_email: z.string().email("E-mail do cliente inválido").optional().nullable(),
  client_cpf: z.string().min(11, "CPF do cliente inválido").max(14).optional().nullable(),
  honorarios: z.number().nonnegative().optional().nullable(),
  vehicle_id: z.string().uuid("ID de veículo inválido").optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
});

export class ContractController {
  async list(_req: Request, res: Response) {
    try {
      return res.json(await contractService.findAll());
    } catch (err) {
      console.error("[contract.list]", err);
      return sendError(res, 500, "Erro ao listar contratos");
    }
  }

  async get(req: Request, res: Response) {
    try {
      const contract = await contractService.findById(req.params.id);
      if (!contract) return sendError(res, 404, "Contrato não encontrado");
      return res.json(contract);
    } catch (err) {
      console.error("[contract.get]", err);
      return sendError(res, 500, "Erro ao obter contrato");
    }
  }

  async templates(req: Request, res: Response) {
    try {
      const area = req.query.area as string | undefined;
      return res.json(contractService.getTemplates(area));
    } catch (err) {
      console.error("[contract.templates]", err);
      return sendError(res, 500, "Erro ao obter templates de contrato");
    }
  }

  async preview(req: Request, res: Response) {
    try {
      const { template_key, client_name } = req.body;
      if (!template_key || !client_name) {
        return sendError(res, 400, "template_key e client_name são obrigatórios");
      }
      return res.json(contractService.preview(req.body));
    } catch (err) {
      console.error("[contract.preview]", err);
      return sendError(res, 500, "Erro ao gerar prévia de contrato");
    }
  }

  async create(req: Request, res: Response) {
    try {
      const parseResult = createContractSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMsg = parseResult.error.issues.map((e: { message: string }) => e.message).join(", ");
        return sendError(res, 400, errorMsg);
      }

      const contract = await contractService.create({
        ...parseResult.data,
        created_by: req.user?.userId,
      });

      if (contract) {
        // Registrar auditoria
        const ipAddress = req.ip || req.socket.remoteAddress || "0.0.0.0";
        const { auditService } = require("../services/audit.service");
        await auditService.logAuditoria({
          userId: req.user?.userId,
          userEmail: req.user?.email,
          action: "CREATE_CONTRACT",
          details: `Contrato '${parseResult.data.title}' criado para o cliente '${parseResult.data.client_name}' com honorários R$ ${parseResult.data.honorarios || 0}.`,
          ipAddress,
        });
      }

      return res.status(201).json(contract);
    } catch (e) {
      return sendError(res, 400, e instanceof Error ? e.message : "Erro ao criar contrato");
    }
  }

  async update(req: Request, res: Response) {
    try {
      const contract = await contractService.update(req.params.id, req.body);
      if (!contract) return sendError(res, 404, "Contrato não encontrado");
      return res.json(contract);
    } catch (err) {
      console.error("[contract.update]", err);
      return sendError(res, 500, "Erro ao atualizar contrato");
    }
  }

  async send(req: Request, res: Response) {
    try {
      const contract = await contractService.send(req.params.id);
      if (!contract) return sendError(res, 404, "Contrato não encontrado");
      return res.json(contract);
    } catch (err) {
      console.error("[contract.send]", err);
      return sendError(res, 500, "Erro ao enviar contrato");
    }
  }

  async sign(req: Request, res: Response) {
    try {
      const contract = await contractService.sign(req.params.id);
      if (!contract) return sendError(res, 404, "Contrato não encontrado");
      return res.json(contract);
    } catch (err) {
      console.error("[contract.sign]", err);
      return sendError(res, 500, "Erro ao assinar contrato");
    }
  }

  async cancel(req: Request, res: Response) {
    try {
      const contract = await contractService.cancel(req.params.id);
      if (!contract) return sendError(res, 404, "Contrato não encontrado");
      return res.json(contract);
    } catch (err) {
      console.error("[contract.cancel]", err);
      return sendError(res, 500, "Erro ao cancelar contrato");
    }
  }
  async quote(req: Request, res: Response) {
    try {
      const { vehicle_id, start_date, end_date, client_name } = req.body;
      if (!vehicle_id || !start_date || !end_date || !client_name) {
        return sendError(res, 400, "vehicle_id, start_date, end_date e client_name são obrigatórios");
      }

      const start = new Date(start_date);
      const end = new Date(end_date);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        return sendError(res, 400, "Datas inválidas. end_date deve ser posterior a start_date.");
      }

      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      // Buscar veículo para calcular preço
      const vehicles = await query<{ id: string; plate: string; brand: string; model: string; year: number }>(
        "SELECT id, plate, brand, model, year FROM vehicles WHERE id = $1",
        [vehicle_id]
      );
      const vehicle = vehicles[0];
      if (!vehicle) return sendError(res, 404, "Veículo não encontrado");

      // Preço base por tipo
      const term = `${vehicle.brand} ${vehicle.model}`.toLowerCase();
      let pricePerDay = 200;
      if (term.includes("scania") || term.includes("volvo")) pricePerDay = 500;
      else if (term.includes("mercedes") || term.includes("iveco")) pricePerDay = 350;
      else if (term.includes("sprinter") || term.includes("transit")) pricePerDay = 180;
      else if (term.includes("hilux") || term.includes("ranger")) pricePerDay = 130;

      const totalValue = pricePerDay * days;
      const pixKey = `fleet-ai@pagamento.com.br`;

      // String EMV PIX simplificada para QR Code
      const pixPayload = [
        "00020126",
        `52040000`,
        `5303986`,
        `54${String(totalValue.toFixed(2)).length.toString().padStart(2, "0")}${totalValue.toFixed(2)}`,
        `5802BR`,
        `5913FleetAI Frotas`,
        `6009Palmas TO`,
        `62070503***`,
        `6304ABCD`,
      ].join("");

      return res.json({
        vehicle: { id: vehicle.id, plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model },
        period: { startDate: start_date, endDate: end_date, days },
        pricing: { pricePerDay, totalValue },
        payment: {
          pixKey,
          pixPayload,
          description: `Locação ${vehicle.brand} ${vehicle.model} — ${days} dia(s) — ${client_name}`,
        },
      });
    } catch (err) {
      console.error("[contract.quote]", err);
      return sendError(res, 500, "Erro ao calcular cotação");
    }
  }
}

export const contractController = new ContractController();
