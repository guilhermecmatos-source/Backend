import mysql from "mysql2/promise";
import { getDbName } from "./connection";
import dotenv from "dotenv";

dotenv.config();

function getBaseConfig(): mysql.ConnectionOptions {
  const url = process.env.DATABASE_URL;
  if (url?.startsWith("mysql://")) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    };
  }
  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  };
}

export async function waitForDatabase(
  maxRetries = Number(process.env.DB_WAIT_RETRIES) || 60,
  intervalMs = Number(process.env.DB_WAIT_INTERVAL) || 2000
): Promise<void> {
  const base = getBaseConfig();
  const dbName = getDbName();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const conn = await mysql.createConnection(base);
      await conn.query("SELECT 1");
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      await conn.end();
      console.log(`[db] MySQL pronto (tentativa ${attempt}/${maxRetries}).`);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[db] Aguardando MySQL (${attempt}/${maxRetries}): ${msg}`);
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}
