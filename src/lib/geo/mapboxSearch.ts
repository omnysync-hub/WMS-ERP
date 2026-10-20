/**
 * Mapbox Search Box API (suggest + retrieve) for address autocomplete.
 *
 * Cost control:
 *  - Callers debounce (350 ms) and only search from 3 characters.
 *  - One session token per address entry, so Mapbox bills one session, not every keystroke.
 *  - In-flight requests are aborted when a newer one starts.
 *  - Small in-memory LRU cache for repeated queries and retrieves.
 *  - country=pk, limit 5, proximity bias (Lahore by default).
 * When NEXT_PUBLIC_MAPBOX_TOKEN is missing or a request fails, callers fall back to plain typing.
 */

export const MAPBOX_TOKEN = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "").trim();
export const mapboxEnabled = () => MAPBOX_TOKEN.startsWith("pk.");

export const MIN_QUERY_CHARS = 3;
export const SEARCH_DEBOUNCE_MS = 350;
const LIMIT = 5;
const BASE = "https://api.mapbox.com/search/searchbox/v1";

export const LAHORE = { lat: 31.5204, lng: 74.3587 };

export type MapboxSuggestion = {
  mapboxId: string;
  title: string;
  subtitle: string;
  fullAddress: string;
};

export type MapboxPlace = {
  fullAddress: string;
  area: string;
  city: string;
  lat: number;
  lng: number;
};

class Lru<V> {
  private map = new Map<string, V>();
  constructor(private max: number) {}
  get(k: string) {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: string, v: V) {
    this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }
}

const suggestCache = new Lru<MapboxSuggestion[]>(60);
const placeCache = new Lru<MapboxPlace>(60);

export function newSessionToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

/** One autocomplete "address entry": keeps its own session token and aborts stale requests. */
export class MapboxAddressSession {
  private token = newSessionToken();
  private controller: AbortController | null = null;

  constructor(private proximity: { lat: number; lng: number } = LAHORE) {}

  setProximity(p: { lat: number; lng: number }) {
    this.proximity = p;
  }

  abort() {
    this.controller?.abort();
    this.controller = null;
  }

  /** Start a new billing session (after an address was picked). */
  reset() {
    this.abort();
    this.token = newSessionToken();
  }

  async suggest(query: string): Promise<MapboxSuggestion[]> {
    const q = query.trim();
    if (!mapboxEnabled() || q.length < MIN_QUERY_CHARS) return [];
    const key = `${q.toLowerCase()}|${this.proximity.lng.toFixed(2)},${this.proximity.lat.toFixed(2)}`;
    const cached = suggestCache.get(key);
    if (cached) return cached;

    this.abort();
    const controller = new AbortController();
    this.controller = controller;
    const params = new URLSearchParams({
      q,
      access_token: MAPBOX_TOKEN,
      session_token: this.token,
      country: "pk",
      language: "en",
      limit: String(LIMIT),
      proximity: `${this.proximity.lng},${this.proximity.lat}`,
      types: "address,street,neighborhood,locality,place,poi,postcode,district",
    });
    const res = await fetch(`${BASE}/suggest?${params}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Mapbox suggest failed (${res.status})`);
    const data = await res.json();
    const list: MapboxSuggestion[] = (Array.isArray(data?.suggestions) ? data.suggestions : [])
      .filter((s: any) => s?.mapbox_id)
      .slice(0, LIMIT)
      .map((s: any) => {
        const title = String(s.name || s.address || s.full_address || q);
        const subtitle = String(s.place_formatted || s.full_address || "");
        return {
          mapboxId: String(s.mapbox_id),
          title,
          subtitle,
          fullAddress: String(s.full_address || [title, subtitle].filter(Boolean).join(", ")),
        };
      });
    suggestCache.set(key, list);
    return list;
  }

  async retrieve(s: MapboxSuggestion): Promise<MapboxPlace | null> {
    if (!mapboxEnabled()) return null;
    const cached = placeCache.get(s.mapboxId);
    if (cached) return cached;
    this.abort();
    const params = new URLSearchParams({ access_token: MAPBOX_TOKEN, session_token: this.token });
    const res = await fetch(`${BASE}/retrieve/${encodeURIComponent(s.mapboxId)}?${params}`);
    if (!res.ok) throw new Error(`Mapbox retrieve failed (${res.status})`);
    const data = await res.json();
    const f = data?.features?.[0];
    const coords = f?.geometry?.coordinates;
    if (!f || !Array.isArray(coords)) return null;
    const p = f.properties || {};
    const ctx = p.context || {};
    const place: MapboxPlace = {
      fullAddress: String(p.full_address || s.fullAddress || [p.name, p.place_formatted].filter(Boolean).join(", ")),
      area: String(ctx.neighborhood?.name || ctx.locality?.name || ctx.district?.name || ""),
      city: String(ctx.place?.name || ctx.region?.name || ""),
      lat: Number(Number(coords[1]).toFixed(6)),
      lng: Number(Number(coords[0]).toFixed(6)),
    };
    placeCache.set(s.mapboxId, place);
    // A picked address ends the billing session; the next search starts a new one.
    this.reset();
    return place;
  }
}
