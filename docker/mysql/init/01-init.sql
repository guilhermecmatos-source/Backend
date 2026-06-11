CREATE DATABASE IF NOT EXISTS fleet_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'fleet_user'@'%' IDENTIFIED BY 'fleet_pass';
GRANT ALL PRIVILEGES ON fleet_db.* TO 'fleet_user'@'%';
FLUSH PRIVILEGES;
