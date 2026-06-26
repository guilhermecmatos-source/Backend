import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import { query } from "../database/connection";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "vehicles");

export class VehicleImageService {
  /**
   * Generate a vehicle image using Gemini Imagen API.
   * Falls back to returning a deterministic static fallback path if no API key is available.
   */
  async generateImage(vehicleId: string, brand: string, model: string, year: number): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY;

    // Always try Gemini Imagen first if API key is available
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `A professional studio-quality photograph of a ${year} ${brand} ${model}, white color, photographed from a 3/4 front angle, clean white background, automotive marketing style, high resolution, well-lit professional photography, no text or watermarks`;

        const response = await ai.models.generateImages({
          model: "imagen-3.0-generate-002",
          prompt,
          config: {
            numberOfImages: 1,
          },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
          const imageData = response.generatedImages[0].image;
          if (imageData && imageData.imageBytes) {
            // Ensure the upload directory exists
            if (!fs.existsSync(UPLOAD_DIR)) {
              fs.mkdirSync(UPLOAD_DIR, { recursive: true });
            }

            const filename = `auto_${vehicleId}_${Date.now()}.png`;
            const filePath = path.join(UPLOAD_DIR, filename);
            const buffer = Buffer.from(imageData.imageBytes, "base64");
            fs.writeFileSync(filePath, buffer);

            const publicPath = `/uploads/vehicles/${filename}`;

            // Update the vehicle's photo_url in the database
            await query(
              "UPDATE vehicles SET photo_url = $1, updated_at = NOW() WHERE id = $2",
              [publicPath, vehicleId]
            );

            console.log(`[VehicleImageService] Generated image for vehicle ${vehicleId}: ${publicPath}`);
            return publicPath;
          }
        }
      } catch (err) {
        console.error(`[VehicleImageService] Imagen API error for vehicle ${vehicleId}:`, err);
        // Fall through to fallback
      }
    }

    // Fallback: return a deterministic path based on brand+model
    const fallbackPath = this.getFallbackImagePath(brand, model);
    if (fallbackPath) {
      // Update the vehicle's photo_url with the fallback path
      await query(
        "UPDATE vehicles SET photo_url = $1, updated_at = NOW() WHERE id = $2",
        [fallbackPath, vehicleId]
      );
      return fallbackPath;
    }

    return null;
  }

  /**
   * Returns a deterministic fallback image path based on brand and model.
   * This maps to pre-generated images stored in the frontend's public/vehicles/ directory.
   */
  getFallbackImagePath(brand: string, model: string): string | null {
    const key = `${brand}_${model}`.toLowerCase().replace(/\s+/g, "_");
    // Return a path that the frontend can resolve from its public directory
    return `/vehicles/${encodeURIComponent(key)}.png`;
  }

  /**
   * Batch-generate images for all vehicles that don't have a photo_url set.
   */
  async generateMissingImages(): Promise<{ vehicleId: string; path: string | null }[]> {
    const vehicles = await query<{ id: string; brand: string; model: string; year: number }>(
      "SELECT id, brand, model, year FROM vehicles WHERE photo_url IS NULL OR photo_url = ''"
    );

    const results: { vehicleId: string; path: string | null }[] = [];
    for (const v of vehicles) {
      const imgPath = await this.generateImage(v.id, v.brand, v.model, v.year);
      results.push({ vehicleId: v.id, path: imgPath });
    }
    return results;
  }
}

export const vehicleImageService = new VehicleImageService();
