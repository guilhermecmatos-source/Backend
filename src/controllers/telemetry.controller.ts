import { Request, Response } from "express";
import { query } from "../database/connection";
import { sendError } from "../utils/errors";
import { z } from "zod";

const createAlertSchema = z.object({
  category: z.string({ message: "A categoria é obrigatória" }).min(1, "A categoria não pode ser vazia"),
  title: z.string({ message: "O título é obrigatório" }).min(3, "O título deve ter pelo menos 3 caracteres"),
  message: z.string({ message: "A mensagem é obrigatória" }).min(5, "A mensagem deve ter pelo menos 5 caracteres"),
  severity: z.enum(["critical", "high", "medium", "info", "error", "warning"] as const, {
    message: "A severidade deve ser: critical, high, medium, info, error ou warning",
  }),
});

/** Retorna alertas de telemetria baseados em falhas mecânicas e heurísticas de fadiga */
export class TelemetryController {
  async alerts(_req: Request, res: Response) {
    try {
      // 1. Manutenções vencidas = falha mecânica iminente
      const mechanicalAlerts = await query<{
        id: string;
        vehicle_id: string;
        plate: string;
        description: string;
        scheduled_at: string;
        type: string;
      }>(
        `SELECT m.id, m.vehicle_id, v.plate, m.description,
                DATE_FORMAT(m.scheduled_at, '%Y-%m-%dT%H:%i:%sZ') as scheduled_at,
                m.type
         FROM maintenances m
         JOIN vehicles v ON v.id = m.vehicle_id
         WHERE m.completed_at IS NULL
           AND m.scheduled_at <= DATE_ADD(NOW(), INTERVAL 2 DAY)
         ORDER BY m.scheduled_at ASC
         LIMIT 10`
      ).catch(() => []);

      // 2. Viagens longas em andamento há mais de 8h = fadiga do motorista
      const fatigueAlerts = await query<{
        id: string;
        driver_name: string;
        origin: string;
        destination: string;
        started_at: string;
        hours_elapsed: string;
      }>(
        `SELECT t.id, d.name as driver_name, t.origin, t.destination,
                DATE_FORMAT(t.started_at, '%Y-%m-%dT%H:%i:%sZ') as started_at,
                CAST(TIMESTAMPDIFF(HOUR, t.started_at, NOW()) AS CHAR) as hours_elapsed
         FROM travels t
         JOIN drivers d ON d.id = t.driver_id
         WHERE t.status = 'in_progress'
           AND t.started_at IS NOT NULL
           AND TIMESTAMPDIFF(HOUR, t.started_at, NOW()) >= 8
         ORDER BY hours_elapsed DESC
         LIMIT 5`
      ).catch(() => []);

      // 3. Desvio de rota: viagens com km percorrido muito maior que distância prevista
      const routeDeviations = await query<{
        id: string;
        origin: string;
        destination: string;
        distance_km: string;
        km_start: string;
        km_end: string;
        plate: string;
      }>(
        `SELECT t.id, t.origin, t.destination,
                CAST(t.distance_km AS CHAR) as distance_km,
                CAST(COALESCE(t.km_start, 0) AS CHAR) as km_start,
                CAST(COALESCE(t.km_end, 0) AS CHAR) as km_end,
                v.plate
         FROM travels t
         JOIN vehicles v ON v.id = t.vehicle_id
         WHERE t.status = 'in_progress'
           AND t.km_start > 0 AND t.km_end > t.km_start
           AND (t.km_end - t.km_start) > (t.distance_km * 1.3)
         LIMIT 5`
      ).catch(() => []);

      const alerts: Array<{
        id: string;
        type: "mechanical" | "fatigue" | "route_deviation";
        severity: "critical" | "high" | "medium";
        title: string;
        message: string;
        timestamp: string;
        metadata: Record<string, unknown>;
      }> = [];

      const now = new Date().toISOString();

      mechanicalAlerts.forEach((m) => {
        const isOverdue = new Date(m.scheduled_at) < new Date();
        alerts.push({
          id: `mec-${m.id}`,
          type: "mechanical",
          severity: isOverdue ? "critical" : "high",
          title: isOverdue ? "⚠️ Falha Mecânica — Manutenção Vencida" : "🔧 Manutenção Urgente",
          message: `Veículo ${m.plate}: ${m.description}. Agendada para ${new Date(m.scheduled_at).toLocaleDateString("pt-BR")}.`,
          timestamp: now,
          metadata: { vehicleId: m.vehicle_id, plate: m.plate, maintenanceId: m.id },
        });
      });

      fatigueAlerts.forEach((f) => {
        const hours = parseInt(f.hours_elapsed);
        alerts.push({
          id: `fat-${f.id}`,
          type: "fatigue",
          severity: hours >= 12 ? "critical" : "high",
          title: "😴 Alerta de Fadiga do Motorista",
          message: `${f.driver_name} está em rota há ${hours}h (${f.origin} → ${f.destination}). Recomenda-se pausa imediata.`,
          timestamp: now,
          metadata: { travelId: f.id, driverName: f.driver_name, hoursElapsed: hours },
        });
      });

      routeDeviations.forEach((r) => {
        const actual = parseFloat(r.km_end) - parseFloat(r.km_start);
        const expected = parseFloat(r.distance_km);
        const deviation = Math.round(((actual - expected) / expected) * 100);
        alerts.push({
          id: `dev-${r.id}`,
          type: "route_deviation",
          severity: deviation > 50 ? "critical" : "medium",
          title: "📍 Desvio de Rota Detectado",
          message: `Veículo ${r.plate} percorreu ${actual.toFixed(0)}km (previsto: ${expected.toFixed(0)}km) — desvio de ${deviation}% na rota ${r.origin} → ${r.destination}.`,
          timestamp: now,
          metadata: { travelId: r.id, plate: r.plate, deviationPercent: deviation },
        });
      });

      // Ordenar por severidade
      const severityOrder = { critical: 0, high: 1, medium: 2 };
      alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return res.json({ alerts, generatedAt: now, total: alerts.length });
    } catch (err) {
      console.error("[telemetry.alerts]", err);
      return sendError(res, 500, "Erro ao carregar alertas de telemetria");
    }
  }
  async listAlerts(_req: Request, res: Response) {
    try {
      const rows = await query(
        "SELECT id, category, title, message, severity, status, DATE_FORMAT(timestamp, '%Y-%m-%dT%H:%i:%sZ') as timestamp FROM telemetry_alerts ORDER BY timestamp DESC LIMIT 50"
      );
      return res.json(rows);
    } catch (err) {
      console.error("[telemetry.listAlerts]", err);
      return sendError(res, 500, "Erro ao obter histórico de alertas");
    }
  }

  async createAlert(req: Request, res: Response) {
    try {
      const parseResult = createAlertSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMsg = parseResult.error.issues.map((e: { message: string }) => e.message).join(", ");
        return sendError(res, 400, errorMsg);
      }

      const { category, title, message, severity } = parseResult.data;

      const rows = await query<{
        id: string;
        category: string;
        title: string;
        message: string;
        severity: string;
        timestamp: string | null;
        created_at: string;
      }>(
        `INSERT INTO telemetry_alerts (category, title, message, severity)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [category, title, message, severity]
      );

      const alert = rows[0];

      if (alert) {
        const { emitTelemetryAlert } = require("../utils/socket");
        emitTelemetryAlert({
          id: alert.id,
          category: alert.category,
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
          timestamp: alert.timestamp || new Date().toISOString()
        });

        // Registrar auditoria
        const ipAddress = req.ip || req.socket.remoteAddress || "0.0.0.0";
        const { auditService } = require("../services/audit.service");
        await auditService.logAuditoria({
          userId: req.user?.userId,
          userEmail: req.user?.email,
          action: "SIMULATE_TELEMETRY",
          details: `Simulação de telemetria disparada. Categoria: ${category}, Título: ${title}, Severidade: ${severity}.`,
          ipAddress,
        });
      }

      return res.status(201).json(alert);
    } catch (err) {
      console.error("[telemetry.createAlert]", err);
      return sendError(res, 500, "Erro ao criar alerta de telemetria");
    }
  }
}

export const telemetryController = new TelemetryController();
