import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { getDbName } from "./connection";

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

export async function runSeed(conn: mysql.Connection): Promise<void> {
  const adminEmail = "admin@fleetai.com";
  const adminPassword = "admin123";
  const hash = await bcrypt.hash(adminPassword, 10);

  await conn.query(
    `INSERT INTO users (name, email, password_hash, role, cpf, rg, cargo, unidade)
     VALUES (?, ?, ?, 'administrador', '00000000191', 'MG-1234567', 'Administrador', 'Matriz')
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       password_hash = VALUES(password_hash),
       role = 'administrador',
       cpf = COALESCE(users.cpf, VALUES(cpf)),
       rg = COALESCE(users.rg, VALUES(rg)),
       cargo = VALUES(cargo),
       unidade = VALUES(unidade)`,
    ["Administrador Fleet AI", adminEmail, hash]
  );
  console.log(`[seed] Admin: ${adminEmail} / ${adminPassword}`);

  // Amanda Silveira - Administrador (admin@fleetai.com.br)
  await conn.query(
    `INSERT INTO users (name, email, password_hash, role, cpf, rg, cargo, unidade)
     VALUES (?, 'admin@fleetai.com.br', ?, 'administrador', '12345678909', 'RG-1111111', 'Gerente Operacional', 'Matriz São Paulo')
     ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), role='administrador'`,
    ["Amanda Silveira", hash]
  );

  // Julian Rodrigues - Gestor (gestor@fleetai.com.br)
  await conn.query(
    `INSERT INTO users (name, email, password_hash, role, cpf, rg, cargo, unidade)
     VALUES (?, 'gestor@fleetai.com.br', ?, 'gestor', '98765432109', 'RG-2222222', 'Coordenador de Pátio', 'Filial Campinas')
     ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), role='gestor'`,
    ["Julian Rodrigues", hash]
  );

  // Carlos Silveira - Solicitante (motorista@fleetai.com.br)
  await conn.query(
    `INSERT INTO users (name, email, password_hash, role, cpf, rg, cargo, unidade)
     VALUES (?, 'motorista@fleetai.com.br', ?, 'solicitante', '39053344705', 'RG-3333333', 'Motorista Prof. Cat. AE', 'Matriz São Paulo')
     ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), role='solicitante'`,
    ["Carlos Silveira", hash]
  );

  const [gestorRows] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT id FROM users WHERE email = 'gestor@fleetai.com' LIMIT 1"
  );
  if (gestorRows.length === 0) {
    const gestorHash = await bcrypt.hash("gestor123", 10);
    await conn.query(
      `INSERT INTO users (name, email, password_hash, role, cpf, cargo, unidade)
       VALUES (?, ?, ?, 'gestor', '52998224725', 'Gestor de Frota', 'Operações')`,
      ["Maria Gestora", "gestor@fleetai.com", gestorHash]
    );
  }

  const [vehicleCount] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) as c FROM vehicles"
  );
  if (Number(vehicleCount[0]?.c) === 0) {
    await conn.query(`
      INSERT INTO vehicles (plate, brand, model, year, status, mileage, avg_consumption, autonomy_km) VALUES
      ('ABC1D23', 'Toyota', 'Hilux', 2023, 'active', 42150, 9.5, 650),
      ('DEF2E45', 'Volkswagen', 'Delivery', 2022, 'active', 88420, 11.2, 520),
      ('GHI3F67', 'Fiat', 'Strada', 2024, 'maintenance', 12800, 10.8, 480),
      ('JKL4G89', 'Mercedes-Benz', 'Sprinter', 2021, 'active', 201000, 12.5, 600),
      ('MEC4D21', 'Mercedes-Benz', 'Atego 2426', 2022, 'active', 145800, 4.2, 850)
    `);
    console.log("[seed] Veículos de exemplo criados.");
  }

  const [driverCount] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) as c FROM drivers"
  );
  const [vehiclesForDrivers] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT id, plate FROM vehicles ORDER BY created_at LIMIT 3"
  );
  if (Number(driverCount[0]?.c) === 0 && vehiclesForDrivers.length >= 2) {
    await conn.query(
      `INSERT INTO drivers (name, license_number, phone, score, active, cpf, rg, cnh_category, cnh_expiry, status, vehicle_id) VALUES
       ('Carlos Eduardo Silva', '12345678901', '11987654321', 94, 1, '39053344705', 'SP-4455667', 'AB', '2028-06-15', 'ativo', ?),
       ('Ana Martins Costa', '98765432109', '11976543210', 88, 1, '15350946056', 'SP-7788990', 'C', '2027-03-20', 'ativo', ?),
       ('João Pereira Santos', '45678912345', '11965432109', 72, 1, '23100299900', 'MG-1122334', 'D', '2026-11-30', 'treinamento', ?)`,
      [
        vehiclesForDrivers[0].id,
        vehiclesForDrivers[1].id,
        vehiclesForDrivers[2]?.id ?? vehiclesForDrivers[0].id,
      ]
    );
    console.log("[seed] Motoristas de exemplo com CNH e veículos vinculados.");
  } else if (vehiclesForDrivers.length > 0) {
    const [unlinked] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id FROM drivers WHERE vehicle_id IS NULL LIMIT 3"
    );
    for (let i = 0; i < unlinked.length; i++) {
      await conn.query("UPDATE drivers SET vehicle_id = ? WHERE id = ?", [
        vehiclesForDrivers[i % vehiclesForDrivers.length].id,
        unlinked[i].id,
      ]);
    }
  }

  const [partnerCount] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) as c FROM partners"
  );
  if (Number(partnerCount[0]?.c) === 0) {
    await conn.query(`
      INSERT INTO partners (name, city, type, email, cnpj, score, status) VALUES
      ('AutoPeças Central Ltda', 'São Paulo, SP', 'distributor', 'contato@autopecas.com', '11222333000181', 94, 'ativo'),
      ('Oficina Velocidade', 'Curitiba, PR', 'workshop', 'suporte@velocidade.com', '11444777000161', 62, 'pendente'),
      ('Revenda Premium Motors', 'Belo Horizonte, MG', 'dealer', 'vendas@premium.com', '11555666000191', 88, 'ativo')
    `);
    const [partners] = await conn.query<mysql.RowDataPacket[]>("SELECT id, name FROM partners LIMIT 2");
    if (partners.length) {
      await conn.query(
        `INSERT INTO partner_tickets (partner_id, subject, partner_name, message, status, priority) VALUES
         (?, 'Integração API frota', ?, 'Solicitação de credenciais para integração REST.', 'aberto', 'alta'),
         (NULL, 'Suporte técnico geral', 'FleetAI Rede', 'Dúvida sobre relatórios de abastecimento.', 'aberto', 'normal')`,
        [partners[0].id, partners[0].name]
      );
    }
    console.log("[seed] Parceiros e chamados de exemplo criados.");
  }

  const [travelCount] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) as c FROM travels"
  );
  if (Number(travelCount[0]?.c) === 0) {
    const [vehicles] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id, plate FROM vehicles ORDER BY created_at LIMIT 2"
    );
    const [drivers] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id FROM drivers ORDER BY created_at LIMIT 2"
    );
    if (vehicles.length >= 2 && drivers.length >= 2) {
      await conn.query(
        `INSERT INTO travels (vehicle_id, driver_id, origin, destination, distance_km, fuel_consumption, status, km_start, km_end, estimated_duration_min, cost) VALUES
         (?, ?, 'São Paulo, SP', 'Curitiba, PR', 408, 42.5, 'in_progress', 42150, 0, 360, 850.00),
         (?, ?, 'Campinas, SP', 'Santos, SP', 168, 18.2, 'scheduled', 88420, 0, 150, 320.00)`,
        [vehicles[0].id, drivers[0].id, vehicles[1].id, drivers[1].id]
      );
      console.log("[seed] Viagens de exemplo criadas.");
    }
  }

  const [fuelCount] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) as c FROM fuel_records"
  );
  if (Number(fuelCount[0]?.c) === 0) {
    const [v] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id, mileage FROM vehicles WHERE plate = 'ABC1D23' LIMIT 1"
    );
    if (v.length) {
      await conn.query(
        `INSERT INTO fuel_records (vehicle_id, liters, cost, mileage_at_fill, station) VALUES
         (?, 55.5, 320.75, ?, 'Posto Ipiranga — Av. Paulista'),
         (?, 48.0, 278.40, ?, 'Shell — Marginal Tietê')`,
        [v[0].id, Number(v[0].mileage) - 500, v[0].id, Number(v[0].mileage)]
      );
      console.log("[seed] Abastecimentos de exemplo criados.");
    }
  }

  const [maintCount] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) as c FROM maintenances"
  );
  if (Number(maintCount[0]?.c) === 0) {
    const [v] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id, mileage FROM vehicles WHERE plate = 'GHI3F67' LIMIT 1"
    );
    if (v.length) {
      const km = Number(v[0].mileage);
      await conn.query(
        `INSERT INTO maintenances (vehicle_id, type, description, cost, scheduled_at, alert_sent) VALUES
         (?, 'preventive', 'Troca de óleo — próxima em 500 km', 450.00, DATE_ADD(NOW(), INTERVAL 7 DAY), 1),
         (?, 'corrective', 'Revisão de freios', 890.00, DATE_ADD(NOW(), INTERVAL 14 DAY), 0)`,
        [v[0].id, v[0].id]
      );
      console.log(`[seed] Manutenções de exemplo (alerta óleo em ~500 km a partir de ${km} km).`);
    }

    // Inserir manutenções e histórico para o Atego 2426 (MEC4D21)
    const [vAtego] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id FROM vehicles WHERE plate = 'MEC4D21' LIMIT 1"
    );
    if (vAtego.length) {
      await conn.query(
        `INSERT INTO maintenances (vehicle_id, type, description, cost, scheduled_at, completed_at, alert_sent) VALUES
         (?, 'preventive', 'Troca de óleo do motor e filtros de ar', 1200.00, DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 30 DAY), 0),
         (?, 'corrective', 'Reparo no sistema de injeção eletrônica', 3400.00, DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_SUB(NOW(), INTERVAL 15 DAY), 0),
         (?, 'corrective', 'Superaquecimento de motor e troca de mangueiras', 2100.00, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY), 0)`,
        [vAtego[0].id, vAtego[0].id, vAtego[0].id]
      );
      console.log("[seed] Manutenções adicionais para Mercedes-Benz Atego criadas.");
    }
  }

  const [ruvCount] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) as c FROM ruv_requests"
  );
  if (Number(ruvCount[0]?.c) === 0) {
    const [solicitante] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id FROM users WHERE email = 'admin@fleetai.com' LIMIT 1"
    );
    if (solicitante.length) {
      await conn.query(
        `INSERT INTO ruv_requests (requester_id, origin, destination, purpose, status, passengers, descricao, quantidade) VALUES
         (?, 'Brasília, DF', 'Goiânia, GO', 'Reunião institucional', 'pendente', 2, 'Carlos Silva, Ana Souza', 2),
         (?, 'São Paulo, SP', 'Ribeirão Preto, SP', 'Entrega de documentos', 'aprovado', 1, 'Marcos Oliveira', 1)`,
        [solicitante[0].id, solicitante[0].id]
      );
      console.log("[seed] Solicitações RUV de exemplo criadas.");
    }
  }

  const [alertCount] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) as c FROM telemetry_alerts"
  );
  if (Number(alertCount[0]?.c) === 0) {
    await conn.query(`
      INSERT INTO telemetry_alerts (category, title, message, severity, status) VALUES
      ('sistema', 'Alerta de Freio Térmico', 'Temperatura do freio do veículo DEF-5678 atingiu 295°C no eixo traseiro direito.', 'error', 'unread'),
      ('motoristas', 'DriverEye Fadiga', 'Condutor Carlos Eduardo com score de fadiga elevado em 82%. Sugerido ponto de parada imediata.', 'warning', 'unread'),
      ('antt', 'ANTT Rotas', 'Veículo GHI-9012 cruzou divisa interestadual em rota homologada ANTT.', 'info', 'read')
    `);
    console.log("[seed] Alertas de telemetria de exemplo criados.");
  }

  // Inserir alerta térmico relacionado ao Atego 2426 (MEC4D21) para a análise preditiva
  const [ategoAlertExist] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) as c FROM telemetry_alerts WHERE message LIKE '%MEC4D21%'"
  );
  if (Number(ategoAlertExist[0]?.c) === 0) {
    await conn.query(`
      INSERT INTO telemetry_alerts (category, title, message, severity, status) VALUES
      ('sistema', 'Alerta Térmico de Freio', 'Temperatura do freio do veículo MEC4D21 atingiu 310°C no eixo dianteiro esquerdo.', 'error', 'unread')
    `);
    console.log("[seed] Alerta térmico do Mercedes-Benz Atego criado.");
  }
}

async function seedCli() {
  const dbName = getDbName();
  const conn = await mysql.createConnection({ ...getBaseConfig(), database: dbName });
  try {
    await runSeed(conn);
    console.log("[seed] Concluído.");
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  seedCli().catch((err) => {
    console.error("[seed] Falhou:", err);
    process.exit(1);
  });
}
