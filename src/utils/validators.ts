export interface ValidationResult {
  valid: boolean;
  message?: string;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function cpfChecksum(digits: number[], factor: number): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) sum += digits[i] * (factor - i);
  const mod = (sum * 10) % 11;
  return mod === 10 ? 0 : mod;
}

export function validateCpf(cpf: string): ValidationResult {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return { valid: false, message: "CPF deve ter 11 dígitos." };
  if (/^(\d)\1{10}$/.test(d)) return { valid: false, message: "CPF inválido." };
  const nums = d.split("").map(Number);
  const d1 = cpfChecksum(nums.slice(0, 9), 10);
  const d2 = cpfChecksum(nums.slice(0, 10), 11);
  if (d1 !== nums[9] || d2 !== nums[10]) return { valid: false, message: "CPF inválido." };
  return { valid: true };
}

export function validateCnpj(cnpj: string): ValidationResult {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return { valid: false, message: "CNPJ deve ter 14 dígitos." };
  if (/^(\d)\1{13}$/.test(d)) return { valid: false, message: "CNPJ inválido." };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const nums = d.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += nums[i] * w1[i];
  let r = sum % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  if (d1 !== nums[12]) return { valid: false, message: "CNPJ inválido." };
  sum = 0;
  for (let i = 0; i < 13; i++) sum += nums[i] * w2[i];
  r = sum % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  if (d2 !== nums[13]) return { valid: false, message: "CNPJ inválido." };
  return { valid: true };
}

export function validateRg(rg: string): ValidationResult {
  const clean = rg.replace(/[^\dA-Za-z]/g, "");
  if (clean.length < 5 || clean.length > 14) {
    return { valid: false, message: "RG inválido (5 a 14 caracteres)." };
  }
  return { valid: true };
}

export function validateCnh(cnh: string): ValidationResult {
  const d = onlyDigits(cnh);
  if (d.length !== 11) return { valid: false, message: "CNH deve ter 11 dígitos." };
  return { valid: true };
}

export function validateCep(cep: string): ValidationResult {
  const d = onlyDigits(cep);
  if (d.length !== 8) return { valid: false, message: "CEP deve ter 8 dígitos." };
  return { valid: true };
}

export function validateEmail(email: string): ValidationResult {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    return { valid: false, message: "E-mail inválido." };
  }
  return { valid: true };
}

export function validatePhone(phone: string): ValidationResult {
  const d = onlyDigits(phone);
  if (d.length < 10 || d.length > 11) {
    return { valid: false, message: "Telefone inválido (10 ou 11 dígitos)." };
  }
  return { valid: true };
}

export function normalizePlate(plate: string): string {
  return plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Placa Mercosul (ABC1D23) ou antiga (ABC1234) */
export function validatePlate(plate: string): ValidationResult {
  const p = normalizePlate(plate);
  const mercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(p);
  const antiga = /^[A-Z]{3}[0-9]{4}$/.test(p);
  if (!mercosul && !antiga) {
    return {
      valid: false,
      message: "Placa inválida. Use formato Mercosul (ABC1D23) ou antigo (ABC1234).",
    };
  }
  return { valid: true };
}

export function formatPlateDisplay(plate: string): string {
  const p = normalizePlate(plate);
  if (/^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(p)) {
    return `${p.slice(0, 3)}-${p[3]}${p[4]}${p.slice(5)}`;
  }
  if (/^[A-Z]{3}[0-9]{4}$/.test(p)) {
    return `${p.slice(0, 3)}-${p.slice(3)}`;
  }
  return p;
}

export function validatePositiveNumber(
  value: unknown,
  label: string,
  allowZero = false
): ValidationResult {
  const n = Number(value);
  if (Number.isNaN(n)) return { valid: false, message: `${label} deve ser numérico.` };
  if (allowZero ? n < 0 : n <= 0) {
    return { valid: false, message: `${label} deve ser maior que zero.` };
  }
  return { valid: true };
}

export function validateDate(value: string, label = "Data"): ValidationResult {
  if (!value?.trim()) return { valid: false, message: `${label} é obrigatória.` };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { valid: false, message: `${label} inválida.` };
  return { valid: true };
}

export const USER_ROLES = [
  "solicitante",
  "motorista",
  "gestor",
  "administrador",
] as const;

export type FleetUserRole = (typeof USER_ROLES)[number];

/** Compatibilidade com papéis legados */
export function normalizeRole(role: string): FleetUserRole {
  const map: Record<string, FleetUserRole> = {
    admin: "administrador",
    attendant: "gestor",
    client: "solicitante",
    administrador: "administrador",
    gestor: "gestor",
    motorista: "motorista",
    solicitante: "solicitante",
  };
  return map[role.toLowerCase()] ?? "solicitante";
}

export function validateUserRole(role: string): ValidationResult {
  const r = normalizeRole(role);
  if (!USER_ROLES.includes(r)) {
    return { valid: false, message: "Perfil inválido." };
  }
  return { valid: true };
}

export function toMysqlDatetime(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return String(dateInput);
  
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const DD = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  
  return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
}

