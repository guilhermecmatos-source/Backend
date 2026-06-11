import bcrypt from "bcryptjs";
import { query } from "../database/connection";
import { User } from "../models/types";
import {
  validateCpf,
  validateEmail,
  validateRg,
  validateUserRole,
  normalizeRole,
  FleetUserRole,
} from "../utils/validators";

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  role: FleetUserRole;
  status: string;
  cpf?: string | null;
  rg?: string | null;
  cargo?: string | null;
  unidade?: string | null;
  created_at: Date;
}

function toPublic(u: User & { status?: string; cpf?: string; rg?: string; cargo?: string; unidade?: string }): UserPublic {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: normalizeRole(u.role),
    status: u.status ?? "approved",
    cpf: u.cpf ?? null,
    rg: u.rg ?? null,
    cargo: u.cargo ?? null,
    unidade: u.unidade ?? null,
    created_at: u.created_at,
  };
}

export class UserService {
  async findAll(status?: string) {
    let sql = "SELECT id, name, email, role, status, cpf, rg, cargo, unidade, created_at FROM users";
    const params: string[] = [];
    if (status) {
      sql += " WHERE status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC";
    const rows = await query<User & { status?: string; cpf?: string; rg?: string; cargo?: string; unidade?: string }>(
      sql,
      params.length ? params : undefined
    );
    return rows.map(toPublic);
  }

  async findById(id: string) {
    const rows = await query<User & { status?: string; cpf?: string; rg?: string; cargo?: string; unidade?: string }>(
      "SELECT id, name, email, role, status, cpf, rg, cargo, unidade, created_at FROM users WHERE id = $1",
      [id]
    );
    return rows[0] ? toPublic(rows[0]) : null;
  }

  validatePayload(data: {
    name?: string;
    email?: string;
    password?: string;
    cpf?: string;
    rg?: string;
    role?: string;
    cargo?: string;
    unidade?: string;
  }, isUpdate = false): string | null {
    if (!isUpdate && (!data.name?.trim() || !data.email?.trim() || !data.password)) {
      return "Nome, e-mail e senha são obrigatórios.";
    }
    if (data.email) {
      const e = validateEmail(data.email);
      if (!e.valid) return e.message ?? "E-mail inválido.";
    }
    if (data.cpf) {
      const c = validateCpf(data.cpf);
      if (!c.valid) return c.message ?? "CPF inválido.";
    }
    if (data.rg) {
      const r = validateRg(data.rg);
      if (!r.valid) return r.message ?? "RG inválido.";
    }
    if (data.role) {
      const ro = validateUserRole(data.role);
      if (!ro.valid) return ro.message ?? "Perfil inválido.";
    }
    return null;
  }

  async create(data: {
    name: string;
    email: string;
    password: string;
    role: string;
    cpf?: string;
    rg?: string;
    cargo?: string;
    unidade?: string;
  }) {
    const err = this.validatePayload(data);
    if (err) throw new Error(err);

    const existing = await query("SELECT id FROM users WHERE email = $1", [
      data.email.trim().toLowerCase(),
    ]);
    if (existing.length > 0) throw new Error("E-mail já cadastrado.");

    const hash = await bcrypt.hash(data.password, 10);
    const role = normalizeRole(data.role);
    await query(
      `INSERT INTO users (name, email, password_hash, role, cpf, rg, cargo, unidade)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        data.name.trim(),
        data.email.trim().toLowerCase(),
        hash,
        role,
        data.cpf ? data.cpf.replace(/\D/g, "") : null,
        data.rg?.trim() ?? null,
        data.cargo?.trim() ?? null,
        data.unidade?.trim() ?? null,
      ]
    );
    const rows = await query<User>(
      "SELECT id, name, email, role, cpf, rg, cargo, unidade, created_at FROM users WHERE email = $1",
      [data.email.trim().toLowerCase()]
    );
    return toPublic(rows[0] as User & { cpf?: string; rg?: string; cargo?: string; unidade?: string });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      email: string;
      password: string;
      role: string;
      cpf: string;
      rg: string;
      cargo: string;
      unidade: string;
    }>
  ) {
    const err = this.validatePayload(data, true);
    if (err) throw new Error(err);

    const current = await this.findById(id);
    if (!current) return null;

    let passwordHash: string | undefined;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 10);
    }

    await query(
      `UPDATE users SET
        name = COALESCE($2, name),
        email = COALESCE($3, email),
        role = COALESCE($4, role),
        cpf = COALESCE($5, cpf),
        rg = COALESCE($6, rg),
        cargo = COALESCE($7, cargo),
        unidade = COALESCE($8, unidade),
        password_hash = COALESCE($9, password_hash)
       WHERE id = $1`,
      [
        id,
        data.name?.trim(),
        data.email?.trim().toLowerCase(),
        data.role ? normalizeRole(data.role) : undefined,
        data.cpf ? data.cpf.replace(/\D/g, "") : undefined,
        data.rg?.trim(),
        data.cargo?.trim(),
        data.unidade?.trim(),
        passwordHash,
      ]
    );
    return this.findById(id);
  }

  async delete(id: string) {
    const rows = await query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
    return rows.length > 0;
  }

  async approve(id: string) {
    await query("UPDATE users SET status = 'approved' WHERE id = $1", [id]);
    return this.findById(id);
  }

  async reject(id: string) {
    await query("DELETE FROM users WHERE id = $1", [id]);
    return true;
  }
}

export const userService = new UserService();
