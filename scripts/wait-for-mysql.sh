#!/bin/sh
set -e

host="${DB_HOST:-mysql}"
port="${DB_PORT:-3306}"
user="${DB_USER:-fleet_user}"
pass="${DB_PASSWORD:-fleet_pass}"
max="${DB_WAIT_RETRIES:-60}"
sleep_sec="${DB_WAIT_INTERVAL:-2}"

echo "[wait-for-mysql] Aguardando MySQL em ${host}:${port} (até ${max} tentativas)..."

i=1
while [ "$i" -le "$max" ]; do
  if node -e "
    const mysql = require('mysql2/promise');
    (async () => {
      const c = await mysql.createConnection({
        host: process.env.DB_HOST || '$host',
        port: Number(process.env.DB_PORT || '$port'),
        user: process.env.DB_USER || '$user',
        password: process.env.DB_PASSWORD || '$pass',
      });
      await c.query('SELECT 1');
      await c.end();
    })().then(() => process.exit(0)).catch(() => process.exit(1));
  " 2>/dev/null; then
    echo "[wait-for-mysql] MySQL disponível (tentativa ${i}/${max})."
    exit 0
  fi
  echo "[wait-for-mysql] Tentativa ${i}/${max} — MySQL ainda indisponível, aguardando ${sleep_sec}s..."
  sleep "$sleep_sec"
  i=$((i + 1))
done

echo "[wait-for-mysql] ERRO: MySQL não respondeu após ${max} tentativas."
exit 1
