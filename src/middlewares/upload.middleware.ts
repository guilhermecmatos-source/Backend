import multer from "multer";
import path from "path";
import fs from "fs";

// No Vercel (serverless) o filesystem é read-only exceto /tmp.
// Em dev usa ./uploads normalmente.
const isServerless = process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
const UPLOAD_DIR = isServerless
  ? "/tmp/uploads"
  : path.join(process.cwd(), "uploads");

try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch {
  // Em ambientes serverless sem /tmp disponível, ignora silenciosamente
  console.warn(`[upload] Não foi possível criar diretório ${UPLOAD_DIR}`);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "application/pdf",
]);

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido. Use JPG, PNG, WebP ou PDF."));
    }
  },
});

export function getUploadPublicPath(filename: string): string {
  return `/uploads/${filename}`;
}

