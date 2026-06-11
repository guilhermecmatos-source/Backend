import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

function getPoolConfig(): mysql.PoolOptions {
  const url = process.env.DATABASE_URL;

  if (url?.startsWith("mysql://")) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ""),
      waitForConnections: true,
      connectionLimit: 10,
    };
  }

  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "fleet_db",
    waitForConnections: true,
    connectionLimit: 10,
  };
}

export const pool = mysql.createPool(getPoolConfig());

/** Converte placeholders PostgreSQL ($1, $2…) para MySQL (?) */
function toMysql(sql: string): string {
  return sql.replace(/\$(\d+)/g, () => "?");
}

const RETURNING_RE = /\s+RETURNING\s+(.+)$/i;

function extractTableName(sql: string): string | null {
  const insert = sql.match(/INSERT\s+INTO\s+`?(\w+)`?/i);
  if (insert) return insert[1];
  const update = sql.match(/UPDATE\s+`?(\w+)`?/i);
  if (update) return update[1];
  const del = sql.match(/DELETE\s+FROM\s+`?(\w+)`?/i);
  if (del) return del[1];
  return null;
}

async function fetchAfterWrite<T>(
  baseSql: string,
  params: unknown[] | undefined,
  returningClause: string
): Promise<T[]> {
  const table = extractTableName(baseSql);
  if (!table) return [];

  const op = baseSql.trim().split(/\s+/)[0].toUpperCase();

  if (op === "INSERT") {
    const [rows] = await pool.query(
      `SELECT ${returningClause === "*" ? "*" : returningClause} FROM \`${table}\` ORDER BY created_at DESC LIMIT 1`
    );
    return rows as T[];
  }

  if ((op === "UPDATE" || op === "DELETE") && params?.[0] != null) {
    if (returningClause.toLowerCase() === "id" && op === "DELETE") {
      return [{ id: params[0] }] as T[];
    }
    const [rows] = await pool.query(
      `SELECT ${returningClause === "*" ? "*" : returningClause} FROM \`${table}\` WHERE id = ? LIMIT 1`,
      [params[0] as string | number]
    );
    return rows as T[];
  }

  return [];
}

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  let sql = text;
  let mappedParams: unknown[] = [];

  if (params && params.length > 0) {
    const placeholders: number[] = [];
    const regex = /\$(\d+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      placeholders.push(parseInt(match[1], 10));
    }

    if (placeholders.length > 0) {
      mappedParams = placeholders.map((idx) => params[idx - 1]);
      sql = text.replace(/\$(\d+)/g, "?");
    } else {
      mappedParams = params;
    }
  } else {
    mappedParams = params || [];
  }

  const returningMatch = sql.match(RETURNING_RE);

  if (!returningMatch) {
    const [rows] = await pool.query(sql, mappedParams as (string | number | boolean | null)[]);
    return rows as T[];
  }

  const returningClause = returningMatch[1].trim();
  const baseSql = sql.replace(RETURNING_RE, "").trim();

  await pool.query(baseSql, mappedParams as (string | number | boolean | null)[]);
  return fetchAfterWrite<T>(baseSql, params, returningClause);
}

export function getDbName(): string {
  const url = process.env.DATABASE_URL;
  if (url?.startsWith("mysql://")) {
    return new URL(url).pathname.replace(/^\//, "") || "fleet_db";
  }
  return process.env.DB_NAME || "fleet_db";
}

/** Testa conexão com o MySQL (útil no boot da API). */
export async function pingDatabase(): Promise<void> {
  await pool.query("SELECT 1");
}
