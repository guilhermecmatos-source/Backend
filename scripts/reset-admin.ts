import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { query } from "../src/database/connection";

dotenv.config();

const ADMIN_EMAIL = "admin@fleetai.com";
const ADMIN_PASSWORD = "admin123";

async function main() {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'administrador')
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       password_hash = VALUES(password_hash),
       role = 'administrador'`,
    ["System Administrator", ADMIN_EMAIL, hash]
  );
  console.log(`Admin OK: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
