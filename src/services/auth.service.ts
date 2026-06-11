import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../database/connection";
import { User, UserRole } from "../models/types";
import { AuthPayload } from "../middlewares/auth.middleware";
import { normalizeRole } from "../utils/validators";

export class AuthService {
  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const users = await query<User>(
      "SELECT * FROM users WHERE email = $1",
      [normalizedEmail]
    );
    if (users.length === 0) {
      throw new Error("Invalid credentials");
    }

    const user = users[0];
    if (user.status === "pending") {
      throw new Error("Sua conta está aguardando aprovação do administrador.");
    }

    const hash = String(user.password_hash ?? "");
    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      throw new Error("Invalid credentials");
    }

    const role = normalizeRole(user.role);
    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      role: role as UserRole,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || "fallback-secret", {
      expiresIn: "8h",
    });

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, role },
    };
  }

  async register(name: string, email: string, password: string, role: UserRole = "client") {
    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.length > 0) {
      throw new Error("Email already registered");
    }

    const hash = await bcrypt.hash(password, 10);
    const normalizedEmail = email.trim().toLowerCase();
    const status = "pending";
    await query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [name, normalizedEmail, hash, role, status]
    );
    const rows = await query<User>(
      "SELECT id, name, email, role, status FROM users WHERE email = $1",
      [normalizedEmail]
    );
    return rows[0];
  }

  async createAttendant(name: string, email: string, password: string) {
    return this.register(name, email, password, "attendant");
  }
}

export const authService = new AuthService();
