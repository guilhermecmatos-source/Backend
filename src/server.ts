import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";

import authRoutes from "./routes/auth.routes";
import vehicleRoutes from "./routes/vehicle.routes";
import driverRoutes from "./routes/driver.routes";
import travelRoutes from "./routes/travel.routes";
import fuelRoutes from "./routes/fuel.routes";
import maintenanceRoutes from "./routes/maintenance.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import geocodingRoutes from "./routes/geocoding.routes";
import uploadRoutes from "./routes/upload.routes";
import userRoutes from "./routes/user.routes";
import ruvRoutes from "./routes/ruv.routes";
import intelligenceRoutes from "./routes/intelligence.routes";
import partnerRoutes from "./routes/partner.routes";
import reportsRoutes from "./routes/reports.routes";
import contractRoutes from "./routes/contract.routes";
import chatRoutes from "./routes/chat.routes";
import { pingDatabase } from "./database/connection";
import { waitForDatabase } from "./database/wait-db";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", async (_req, res) => {
  try {
    await pingDatabase();
    res.json({ status: "ok", service: "fleet-platform-api", database: "connected" });
  } catch {
    res.status(503).json({ status: "degraded", service: "fleet-platform-api", database: "disconnected" });
  }
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (_req, res) => {
  res.json(swaggerSpec);
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/travels", travelRoutes);
app.use("/api/fuel", fuelRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/geocoding", geocodingRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/ruv", ruvRoutes);
app.use("/api/intelligence", intelligenceRoutes);
app.use("/api/partners", partnerRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/chat", chatRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

async function startServer() {
  const maxRetries = Number(process.env.SERVER_DB_RETRIES) || 30;
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await waitForDatabase(5, 2000);
      await pingDatabase();
      break;
    } catch (err) {
      console.warn(`[api] Aguardando banco (${i}/${maxRetries})...`, err);
      if (i === maxRetries) {
        console.error("[api] Não foi possível conectar ao MySQL. Encerrando.");
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[api] Fleet Platform API em http://0.0.0.0:${PORT}`);
    console.log("[api] MySQL conectado.");
  });
}

startServer().catch((err) => {
  console.error("[api] Falha ao iniciar:", err);
  process.exit(1);
});
