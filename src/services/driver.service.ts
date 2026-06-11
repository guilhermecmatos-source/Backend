import { query } from "../database/connection";
import { Driver } from "../models/types";
import { predictiveService } from "../ai/predictive.service";
import { validateCnh, validateCpf, validatePhone, validateRg } from "../utils/validators";
import { vehicleService } from "./vehicle.service";

export class DriverService {
  async findAll() {
    return query<Driver & { trip_count?: number; vehicle_plate?: string }>(
      `SELECT d.*, CAST(COUNT(t.id) AS UNSIGNED) as trip_count, v.plate as vehicle_plate
       FROM drivers d
       LEFT JOIN travels t ON t.driver_id = d.id
       LEFT JOIN vehicles v ON v.id = d.vehicle_id
       GROUP BY d.id
       ORDER BY d.created_at DESC`
    );
  }

  async findById(id: string) {
    const rows = await query<Driver & { vehicle_plate?: string }>(
      `SELECT d.*, v.plate as vehicle_plate FROM drivers d
       LEFT JOIN vehicles v ON v.id = d.vehicle_id
       WHERE d.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async findImages(driverId: string) {
    return query<{ id: string; path: string; filename: string; mime_type: string; created_at: string }>(
      `SELECT id, path, filename, mime_type, created_at FROM uploads
       WHERE entity_id = $1 AND entity_type IN ('driver_cnh', 'driver_profile')
       ORDER BY created_at DESC`,
      [driverId]
    );
  }

  validatePayload(data: {
    name?: string;
    license_number?: string;
    cpf?: string;
    rg?: string;
    phone?: string;
    vehicle_id?: string;
    requireVehicle?: boolean;
  }): string | null {
    if (!data.name?.trim()) return "Nome é obrigatório.";
    if (!data.license_number?.trim()) return "CNH é obrigatória.";
    const cnh = validateCnh(data.license_number);
    if (!cnh.valid) return cnh.message ?? "CNH inválida.";
    if (!data.cpf?.trim()) return "CPF é obrigatório.";
    const c = validateCpf(data.cpf);
    if (!c.valid) return c.message ?? "CPF inválido.";
    if (data.rg) {
      const r = validateRg(data.rg);
      if (!r.valid) return r.message ?? "RG inválido.";
    }
    if (data.phone) {
      const p = validatePhone(data.phone);
      if (!p.valid) return p.message ?? "Telefone inválido.";
    }
    if (data.requireVehicle !== false && !data.vehicle_id?.trim()) {
      return "Veículo vinculado é obrigatório.";
    }
    return null;
  }

  async create(data: {
    name: string;
    license_number: string;
    phone?: string;
    cpf?: string;
    rg?: string;
    cnh_category?: string;
    cnh_expiry?: string;
    status?: string;
    vehicle_id?: string;
  }) {
    const err = this.validatePayload({ ...data, requireVehicle: true });
    if (err) throw new Error(err);

    if (data.vehicle_id) {
      const vehicle = await vehicleService.findById(data.vehicle_id);
      if (!vehicle) throw new Error("Veículo vinculado não encontrado.");
    }

    const rows = await query<Driver>(
      `INSERT INTO drivers (name, license_number, phone, cpf, rg, cnh_category, cnh_expiry, status, vehicle_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        data.name.trim(),
        data.license_number.replace(/\D/g, ""),
        data.phone ?? null,
        data.cpf ? data.cpf.replace(/\D/g, "") : null,
        data.rg?.trim() ?? null,
        data.cnh_category?.toUpperCase() ?? null,
        data.cnh_expiry ?? null,
        data.status ?? "ativo",
        data.vehicle_id ?? null,
      ]
    );
    return this.findById(rows[0].id);
  }

  async update(id: string, data: Partial<Driver> & { vehicle_id?: string }) {
    const current = await this.findById(id);
    if (!current) return null;
    const err = this.validatePayload({
      name: data.name ?? current.name,
      license_number: data.license_number ?? current.license_number,
      cpf: data.cpf ?? current.cpf ?? undefined,
      rg: data.rg ?? undefined,
      phone: data.phone ?? undefined,
      vehicle_id: data.vehicle_id ?? current.vehicle_id ?? undefined,
      requireVehicle: true,
    });
    if (err) throw new Error(err);

    if (data.vehicle_id) {
      const vehicle = await vehicleService.findById(data.vehicle_id);
      if (!vehicle) throw new Error("Veículo vinculado não encontrado.");
    }

    const rows = await query<Driver>(
      `UPDATE drivers SET
        name = COALESCE($2, name),
        license_number = COALESCE($3, license_number),
        phone = COALESCE($4, phone),
        active = COALESCE($5, active),
        cpf = COALESCE($6, cpf),
        rg = COALESCE($7, rg),
        cnh_category = COALESCE($8, cnh_category),
        cnh_expiry = COALESCE($9, cnh_expiry),
        status = COALESCE($10, status),
        vehicle_id = COALESCE($11, vehicle_id),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        data.name,
        data.license_number ? data.license_number.replace(/\D/g, "") : undefined,
        data.phone,
        data.active,
        data.cpf ? String(data.cpf).replace(/\D/g, "") : undefined,
        data.rg,
        data.cnh_category,
        data.cnh_expiry,
        data.status,
        data.vehicle_id,
      ]
    );
    if (rows[0]) {
      const score = await predictiveService.calculateDriverScore(id);
      await query("UPDATE drivers SET score = $2 WHERE id = $1", [id, score]);
      rows[0].score = score;
    }
    return this.findById(id);
  }

  async delete(id: string) {
    const linked = await query<{ c: string }>(
      "SELECT CAST(COUNT(*) AS CHAR) as c FROM travels WHERE driver_id = $1",
      [id]
    );
    if (parseInt(linked[0]?.c ?? "0") > 0) {
      throw new Error("Motorista possui viagens vinculadas e não pode ser excluído.");
    }
    const rows = await query("DELETE FROM drivers WHERE id = $1 RETURNING id", [id]);
    return rows.length > 0;
  }

  async refreshScore(id: string) {
    const score = await predictiveService.calculateDriverScore(id);
    await query("UPDATE drivers SET score = $2, updated_at = NOW() WHERE id = $1", [id, score]);
    return score;
  }
}

export const driverService = new DriverService();
