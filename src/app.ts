import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
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
import marketplaceRoutes from "./routes/marketplace.routes";
import telemetryRoutes from "./routes/telemetry.routes";
import { pingDatabase } from "./database/connection";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploads locais apenas em desenvolvimento (no Vercel não há filesystem persistente)
if (process.env.VERCEL !== "1") {
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
}


app.get("/health", async (_req, res) => {
  try {
    await pingDatabase();
    res.json({ status: "ok", service: "fleet-platform-api", database: "connected" });
  } catch {
    res.status(503).json({ status: "degraded", service: "fleet-platform-api", database: "disconnected" });
  }
});

// Swagger UI via CDN — funciona tanto em dev quanto em serverless (Vercel)
// swagger-ui-express serve assets estáticos do node_modules que não ficam
// disponíveis no bundle do Vercel, por isso usamos o CDN da jsDelivr.
app.get("/api-docs", (_req, res) => {
  const specUrl = "/api-docs.json";
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fleet Platform API — Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    SwaggerUIBundle({
      url: "${specUrl}",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: "StandaloneLayout",
      deepLinking: true,
    });
  </script>
</body>
</html>`);
});

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
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/telemetry", telemetryRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

export default app;
