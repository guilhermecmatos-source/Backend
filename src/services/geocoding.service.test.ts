import { describe, expect, it } from "vitest";

/** Testa heurística exportada indiretamente via resolveRouteDistance sem chaves API */
describe("geocoding fallback", () => {
  it("retorna distância conhecida para par de cidades", async () => {
    const { resolveRouteDistance } = await import("./geocoding.service");
    const prev = process.env.GEO_PROVIDER_ORDER;
    process.env.GEO_PROVIDER_ORDER = "heuristic";
    const result = await resolveRouteDistance("São Paulo", "Curitiba");
    process.env.GEO_PROVIDER_ORDER = prev;
    expect(result.provider).toBe("heuristic");
    expect(result.distanceKm).toBe(408);
  });
});
