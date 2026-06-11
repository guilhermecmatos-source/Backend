import { Request, Response } from "express";
import { query } from "../database/connection";
import { getUploadPublicPath } from "../middlewares/upload.middleware";
import { sendError } from "../utils/errors";

export class UploadController {
  async uploadFile(req: Request, res: Response) {
    if (!req.file) return sendError(res, 400, "Nenhum arquivo enviado");

    const entityType = String(req.body.entityType || "generic");
    const entityId = req.body.entityId ? String(req.body.entityId) : null;
    const publicPath = getUploadPublicPath(req.file.filename);

    await query(
      `INSERT INTO uploads (entity_type, entity_id, filename, mime_type, path, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entityType, entityId, req.file.originalname, req.file.mimetype, publicPath, req.file.size]
    );

    if (entityId) {
      if (entityType === "driver_cnh") {
        if (req.file.mimetype === "application/pdf") {
          await query(
            `UPDATE drivers SET cnh_pdf_url = $2, updated_at = NOW() WHERE id = $1`,
            [entityId, publicPath]
          );
        } else {
          await query(
            `UPDATE drivers SET cnh_image_url = $2, updated_at = NOW() WHERE id = $1`,
            [entityId, publicPath]
          );
        }
      } else if (entityType === "driver_profile") {
        await query(
          `UPDATE drivers SET profile_image_url = $2, updated_at = NOW() WHERE id = $1`,
          [entityId, publicPath]
        );
      } else if (entityType === "vehicle") {
        await query(`UPDATE vehicles SET photo_url = $2, updated_at = NOW() WHERE id = $1`, [
          entityId,
          publicPath,
        ]);
      } else if (entityType === "fuel_receipt") {
        await query(`UPDATE fuel_records SET receipt_url = $2 WHERE id = $1`, [
          entityId,
          publicPath,
        ]);
      } else if (entityType === "partner") {
        await query(`UPDATE partners SET logo_url = $2, updated_at = NOW() WHERE id = $1`, [
          entityId,
          publicPath,
        ]);
      }
    }

    return res.status(201).json({
      path: publicPath,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  }
}

export const uploadController = new UploadController();
