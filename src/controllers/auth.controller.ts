import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { sendError } from "../utils/errors";

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) return sendError(res, 400, "Email and password are required");
      const result = await authService.login(String(email).trim().toLowerCase(), password);
      return res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const sqlMessage =
        err && typeof err === "object" && "sqlMessage" in err
          ? String((err as { sqlMessage?: string }).sqlMessage)
          : "";

      if (
        message.includes("ECONNREFUSED") ||
        message.includes("ER_ACCESS_DENIED") ||
        message.includes("ER_BAD_DB_ERROR") ||
        message.includes("connect") ||
        sqlMessage.includes("Access denied")
      ) {
        console.error("[auth/login] Database error:", err);
        return sendError(
          res,
          503,
          "Banco de dados indisponível. Verifique MySQL e execute: npm run db:migrate"
        );
      }
      if (message === "Invalid credentials") {
        return sendError(res, 401, "Credenciais inválidas");
      }
      console.error("[auth/login]", err);
      return sendError(
        res,
        500,
        "Erro no servidor ao autenticar. Reinicie o backend e tente novamente."
      );
    }
  }

  async register(req: Request, res: Response) {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) return sendError(res, 400, "All fields are required");
      const user = await authService.register(name, email, password);
      return res.status(201).json(user);
    } catch (err) {
      return sendError(res, 400, err instanceof Error ? err.message : "Registration failed");
    }
  }

  async createAttendant(req: Request, res: Response) {
    try {
      const { name, email, password } = req.body;
      const user = await authService.createAttendant(name, email, password);
      return res.status(201).json(user);
    } catch (err) {
      return sendError(res, 400, err instanceof Error ? err.message : "Failed to create attendant");
    }
  }

  logout(_req: Request, res: Response) {
    return res.json({ message: "Logged out successfully" });
  }

  me(req: Request, res: Response) {
    return res.json({ user: req.user });
  }
}

export const authController = new AuthController();
