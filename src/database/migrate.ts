import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { getDbName } from "./connection";
import { waitForDatabase } from "./wait-db";
import { runSeed } from "./seed";

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

async function columnExists(
  conn: mysql.Connection,
  table: string,
  column: string
): Promise<boolean> {
  const dbName = getDbName();
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, table, column]
  );
  return Number(rows[0]?.c) > 0;
}

async function ensureColumn(
  conn: mysql.Connection,
  table: string,
  column: string,
  definition: string
) {
  if (!(await columnExists(conn, table, column))) {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
    console.log(`[migrate] Coluna ${table}.${column} adicionada.`);
  }
}

async function migrate() {
  await waitForDatabase();
  const dbName = getDbName();
  const baseConfig = getBaseConfig();

  const bootstrap = await mysql.createConnection(baseConfig);
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await bootstrap.end();

  const conn = await mysql.createConnection({ ...baseConfig, database: dbName });

  try {
    await conn.beginTransaction();

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'solicitante',
        cpf VARCHAR(14) NULL,
        rg VARCHAR(20) NULL,
        cargo VARCHAR(100) NULL,
        unidade VARCHAR(100) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await ensureColumn(conn, "users", "cpf", "cpf VARCHAR(14) NULL");
    await ensureColumn(conn, "users", "rg", "rg VARCHAR(20) NULL");
    await ensureColumn(conn, "users", "cargo", "cargo VARCHAR(100) NULL");
    await ensureColumn(conn, "users", "unidade", "unidade VARCHAR(100) NULL");
    await ensureColumn(conn, "users", "status", "status VARCHAR(50) DEFAULT 'approved'");
    await ensureColumn(
      conn,
      "users",
      "updated_at",
      "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    );

    const [userChecks] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND CONSTRAINT_TYPE = 'CHECK'`,
      [dbName]
    );
    for (const row of userChecks) {
      try {
        await conn.query(`ALTER TABLE users DROP CHECK \`${row.CONSTRAINT_NAME}\``);
        console.log(`[migrate] CHECK removido: users.${row.CONSTRAINT_NAME}`);
      } catch {
        /* constraint já removida */
      }
    }

    await conn.query(`UPDATE users SET role = 'administrador' WHERE role = 'admin'`);
    await conn.query(`UPDATE users SET role = 'gestor' WHERE role = 'attendant'`);
    await conn.query(`UPDATE users SET role = 'solicitante' WHERE role = 'client'`);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        plate VARCHAR(20) UNIQUE NOT NULL,
        brand VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        year INT NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        mileage DECIMAL(12,2) DEFAULT 0,
        avg_consumption DECIMAL(8,2) NULL,
        autonomy_km DECIMAL(10,2) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await ensureColumn(conn, "vehicles", "avg_consumption", "avg_consumption DECIMAL(8,2) NULL");
    await ensureColumn(conn, "vehicles", "autonomy_km", "autonomy_km DECIMAL(10,2) NULL");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(255) NOT NULL,
        license_number VARCHAR(50) UNIQUE NOT NULL,
        phone VARCHAR(30),
        score DECIMAL(5,2) DEFAULT 100,
        active TINYINT(1) DEFAULT 1,
        cpf VARCHAR(14) NULL,
        rg VARCHAR(20) NULL,
        cnh_category VARCHAR(5) NULL,
        cnh_expiry DATE NULL,
        status VARCHAR(30) DEFAULT 'ativo',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await ensureColumn(conn, "drivers", "cpf", "cpf VARCHAR(14) NULL");
    await ensureColumn(conn, "drivers", "rg", "rg VARCHAR(20) NULL");
    await ensureColumn(conn, "drivers", "cnh_category", "cnh_category VARCHAR(5) NULL");
    await ensureColumn(conn, "drivers", "cnh_expiry", "cnh_expiry DATE NULL");
    await ensureColumn(conn, "drivers", "status", "status VARCHAR(30) DEFAULT 'ativo'");
    await ensureColumn(conn, "drivers", "vehicle_id", "vehicle_id CHAR(36) NULL");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS partners (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(255) NOT NULL,
        city VARCHAR(120) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'workshop',
        email VARCHAR(255) NULL,
        cnpj VARCHAR(18) NULL,
        phone VARCHAR(30) NULL,
        score DECIMAL(5,2) DEFAULT 80,
        status VARCHAR(30) DEFAULT 'ativo',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS partner_tickets (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        partner_id CHAR(36) NULL,
        subject VARCHAR(255) NOT NULL,
        partner_name VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(30) DEFAULT 'aberto',
        priority VARCHAR(20) DEFAULT 'normal',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS travels (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        vehicle_id CHAR(36),
        driver_id CHAR(36),
        origin VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        distance_km DECIMAL(10,2) DEFAULT 0,
        fuel_consumption DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'scheduled',
        km_start DECIMAL(12,2) NULL,
        km_end DECIMAL(12,2) NULL,
        estimated_duration_min INT NULL,
        cost DECIMAL(12,2) DEFAULT 0,
        checklist_departure JSON NULL,
        checklist_arrival JSON NULL,
        started_at DATETIME NULL,
        ended_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
        FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
      )
    `);
    await ensureColumn(conn, "travels", "km_start", "km_start DECIMAL(12,2) NULL");
    await ensureColumn(conn, "travels", "km_end", "km_end DECIMAL(12,2) NULL");
    await ensureColumn(conn, "travels", "estimated_duration_min", "estimated_duration_min INT NULL");
    await ensureColumn(conn, "travels", "cost", "cost DECIMAL(12,2) DEFAULT 0");
    await ensureColumn(conn, "travels", "checklist_departure", "checklist_departure JSON NULL");
    await ensureColumn(conn, "travels", "checklist_arrival", "checklist_arrival JSON NULL");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS fuel_records (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        vehicle_id CHAR(36),
        liters DECIMAL(10,2) NOT NULL,
        cost DECIMAL(12,2) NOT NULL,
        mileage_at_fill DECIMAL(12,2) NOT NULL,
        station VARCHAR(255),
        filled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        suspicious TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS maintenances (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        vehicle_id CHAR(36),
        type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        cost DECIMAL(12,2) DEFAULT 0,
        scheduled_at DATETIME NOT NULL,
        completed_at DATETIME NULL,
        alert_sent TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS ruv_requests (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        requester_id CHAR(36) NOT NULL,
        origin VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        purpose TEXT NOT NULL,
        status VARCHAR(30) DEFAULT 'pendente',
        passengers INT DEFAULT 1,
        descricao TEXT NULL,
        quantidade INT DEFAULT 1,
        justification TEXT NULL,
        approved_by CHAR(36) NULL,
        rejected_by CHAR(36) NULL,
        vehicle_id CHAR(36) NULL,
        driver_id CHAR(36) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        entity_type VARCHAR(50) NOT NULL,
        entity_id CHAR(36) NOT NULL,
        action VARCHAR(20) NOT NULL,
        user_id CHAR(36) NULL,
        user_email VARCHAR(255) NULL,
        details TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await ensureColumn(conn, "drivers", "profile_image_url", "profile_image_url VARCHAR(512) NULL");
    await ensureColumn(conn, "drivers", "cnh_image_url", "cnh_image_url VARCHAR(512) NULL");
    await ensureColumn(conn, "drivers", "cnh_pdf_url", "cnh_pdf_url VARCHAR(512) NULL");
    await ensureColumn(conn, "vehicles", "photo_url", "photo_url VARCHAR(512) NULL");
    await ensureColumn(conn, "fuel_records", "receipt_url", "receipt_url VARCHAR(512) NULL");
    await ensureColumn(conn, "partners", "logo_url", "logo_url VARCHAR(512) NULL");
    await ensureColumn(conn, "partners", "address", "address VARCHAR(255) NULL");
    await ensureColumn(conn, "partners", "notes", "notes TEXT NULL");
    await ensureColumn(conn, "ruv_requests", "descricao", "descricao TEXT NULL");
    await ensureColumn(conn, "ruv_requests", "quantidade", "quantidade INT DEFAULT 1");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        entity_type VARCHAR(50) NOT NULL,
        entity_id CHAR(36) NULL,
        filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        path VARCHAR(512) NOT NULL,
        size_bytes INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        sender_id CHAR(36) NOT NULL,
        receiver_id CHAR(36) NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS partner_messages (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        partner_id CHAR(36) NOT NULL,
        sender_name VARCHAR(255) NOT NULL,
        sender_role VARCHAR(50) DEFAULT 'administrador',
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        title VARCHAR(255) NOT NULL,
        area VARCHAR(50) NOT NULL,
        template_key VARCHAR(80) NOT NULL,
        client_name VARCHAR(255) NOT NULL,
        client_email VARCHAR(255) NULL,
        client_cpf VARCHAR(14) NULL,
        content LONGTEXT NOT NULL,
        honorarios DECIMAL(12,2) DEFAULT 0,
        status VARCHAR(40) DEFAULT 'rascunho',
        signature_step TINYINT DEFAULT 1,
        sent_at DATETIME NULL,
        signed_at DATETIME NULL,
        cancelled_at DATETIME NULL,
        notification_sent TINYINT(1) DEFAULT 0,
        reminder_sent TINYINT(1) DEFAULT 0,
        created_by CHAR(36) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS contract_notifications (
        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
        contract_id CHAR(36) NOT NULL,
        channel VARCHAR(30) DEFAULT 'sistema',
        message TEXT NOT NULL,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
      )
    `);

    await conn.commit();
    console.log(`[migrate] Schema OK em "${dbName}".`);

    await runSeed(conn);
    console.log(`[migrate] Concluído.`);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

migrate().catch((err) => {
  console.error("[migrate] Falhou:", err);
  process.exit(1);
});
