import dotenv from "dotenv";
import app from "./app";
import { pingDatabase } from "./database/connection";
import { waitForDatabase } from "./database/wait-db";

dotenv.config();

const PORT = process.env.PORT || 3001;

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

