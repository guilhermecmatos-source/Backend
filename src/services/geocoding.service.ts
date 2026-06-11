type GeoProvider = "google" | "osm" | "qualp" | "mapeia" | "heuristic";

export interface RouteDistanceResult {
  distanceKm: number;
  durationMinutes?: number;
  provider: GeoProvider;
  polyline?: string;
}

const CITY_PAIRS: [string, string, number][] = [
  ["são paulo", "curitiba", 408],
  ["sao paulo", "curitiba", 408],
  ["campinas", "santos", 168],
  ["belo horizonte", "rio de janeiro", 434],
  ["são paulo", "rio de janeiro", 429],
  ["sao paulo", "rio de janeiro", 429],
];

function estimateHeuristic(origin: string, destination: string): number {
  const o = origin.toLowerCase().trim();
  const d = destination.toLowerCase().trim();
  for (const [a, b, km] of CITY_PAIRS) {
    if ((o.includes(a) && d.includes(b)) || (o.includes(b) && d.includes(a))) return km;
  }
  return Math.round(80 + ((o.length + d.length) / 12) * 35);
}

async function googleDistance(origin: string, destination: string): Promise<RouteDistanceResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("key", key);
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("units", "metric");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as {
    rows?: { elements?: { status: string; distance?: { value: number }; duration?: { value: number } }[] }[];
  };
  const el = data.rows?.[0]?.elements?.[0];
  if (!el || el.status !== "OK" || !el.distance) return null;

  return {
    distanceKm: Math.round((el.distance.value / 1000) * 10) / 10,
    durationMinutes: el.duration ? Math.round(el.duration.value / 60) : undefined,
    provider: "google",
  };
}

async function qualpDistance(origin: string, destination: string): Promise<RouteDistanceResult | null> {
  const key = process.env.QUALP_API_KEY;
  const base = process.env.QUALP_API_URL;
  if (!key || !base) return null;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/route/distance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ origin, destination }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { distance_km?: number; duration_minutes?: number };
    if (!data.distance_km) return null;
    return {
      distanceKm: data.distance_km,
      durationMinutes: data.duration_minutes,
      provider: "qualp",
    };
  } catch {
    return null;
  }
}

async function geocodeNominatim(place: string): Promise<{ lat: number; lon: number } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", place);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "FleetAI/1.0 (fleet-management)" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { lat: string; lon: string }[];
  if (!data[0]) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function osmDistance(origin: string, destination: string): Promise<RouteDistanceResult | null> {
  try {
    const [o, d] = await Promise.all([geocodeNominatim(origin), geocodeNominatim(destination)]);
    if (!o || !d) return null;

    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
    const res = await fetch(routeUrl, {
      headers: { "User-Agent": "FleetAI/1.0" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: { distance: number; duration: number }[];
    };
    const route = data.routes?.[0];
    if (!route) return null;

    return {
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMinutes: Math.round(route.duration / 60),
      provider: "osm",
    };
  } catch {
    return null;
  }
}

async function mapeiaDistance(origin: string, destination: string): Promise<RouteDistanceResult | null> {
  const key = process.env.MAPEIA_API_KEY;
  const base = process.env.MAPEIA_API_URL;
  if (!key || !base) return null;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/v1/routes/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": key,
      },
      body: JSON.stringify({ from: origin, to: destination }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { distanceKm?: number; durationMinutes?: number };
    if (!data.distanceKm) return null;
    return {
      distanceKm: data.distanceKm,
      durationMinutes: data.durationMinutes,
      provider: "mapeia",
    };
  } catch {
    return null;
  }
}

export interface PlaceSuggestion {
  label: string;
  lat: number;
  lon: number;
}

export async function searchPlaces(queryText: string, limit = 6): Promise<PlaceSuggestion[]> {
  const q = queryText?.trim();
  if (!q || q.length < 3) return [];

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
      url.searchParams.set("input", q);
      url.searchParams.set("key", key);
      url.searchParams.set("language", "pt-BR");
      url.searchParams.set("components", "country:br");
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = (await res.json()) as {
          predictions?: { description: string; place_id: string }[];
        };
        const preds = data.predictions?.slice(0, limit) ?? [];
        const out: PlaceSuggestion[] = [];
        for (const p of preds) {
          const detailUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
          detailUrl.searchParams.set("place_id", p.place_id);
          detailUrl.searchParams.set("fields", "geometry");
          detailUrl.searchParams.set("key", key);
          const dRes = await fetch(detailUrl.toString());
          if (!dRes.ok) continue;
          const dData = (await dRes.json()) as {
            result?: { geometry?: { location?: { lat: number; lng: number } } };
          };
          const loc = dData.result?.geometry?.location;
          if (loc) out.push({ label: p.description, lat: loc.lat, lon: loc.lng });
        }
        if (out.length) return out;
      }
    } catch {
      /* fallback OSM */
    }
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("countrycodes", "br");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "FleetAI/1.0 (fleet-management)" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return data.map((row) => ({
    label: row.display_name,
    lat: parseFloat(row.lat),
    lon: parseFloat(row.lon),
  }));
}

export async function resolveRouteDistance(
  origin: string,
  destination: string
): Promise<RouteDistanceResult> {
  const o = origin?.trim();
  const d = destination?.trim();
  if (!o || !d) {
    return { distanceKm: 0, provider: "heuristic" };
  }

  const providerOrder = (process.env.GEO_PROVIDER_ORDER || "google,osm,qualp,mapeia,heuristic")
    .split(",")
    .map((p) => p.trim().toLowerCase());

  for (const provider of providerOrder) {
    let result: RouteDistanceResult | null = null;
    if (provider === "google") result = await googleDistance(o, d);
    else if (provider === "osm") result = await osmDistance(o, d);
    else if (provider === "qualp") result = await qualpDistance(o, d);
    else if (provider === "mapeia") result = await mapeiaDistance(o, d);
    if (result && result.distanceKm > 0) return result;
  }

  return {
    distanceKm: estimateHeuristic(o, d),
    provider: "heuristic",
  };
}
