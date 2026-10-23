/**
 * Add a stock unit to the shared Units list (the `workman_stock_units` setting on the server).
 *
 * Read-modify-write against the SERVER list (never the browser's cached copy), so a stale local
 * copy cannot overwrite units that were added elsewhere. Matching is case-insensitive; when the
 * unit already exists its stored spelling is returned so products always match a list entry exactly.
 */
import { pushSharedSetting } from "@/lib/sharedSettings";

const KEY = "workman_stock_units";

export interface StockUnitEntry {
  id: string;
  name: string;
  status: "Active" | "Inactive";
}

/** Same normalisation as the Units screen: trim, first letter upper-case, rest as typed. */
export function normalizeStockUnitName(raw: string): string {
  const clean = raw.trim().replace(/\s+/g, " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

async function readServerUnits(): Promise<StockUnitEntry[] | null> {
  const response = await fetch("/api/app-settings", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the Units list from the server. Please try again.");
  const data = await response.json().catch(() => ({}));
  const list = data?.settings?.[KEY];
  return Array.isArray(list) ? (list as StockUnitEntry[]) : null;
}

/** Returns the unit name to store on the product. Throws (with a readable message) if it cannot be saved. */
export async function ensureStockUnit(rawName: string): Promise<string> {
  const name = normalizeStockUnitName(rawName);
  if (!name) throw new Error("Please enter a unit.");

  let current = await readServerUnits();
  if (current === null) {
    // Nothing saved on the server yet: start from this browser's list, or the default.
    try {
      const cached = JSON.parse(localStorage.getItem(KEY) || "null");
      current = Array.isArray(cached) && cached.length > 0 ? cached : null;
    } catch {
      current = null;
    }
    if (!current) current = [{ id: "unit-pcs", name: "Pieces", status: "Active" }];
  }

  const existing = current.find((u) => String(u.name || "").trim().toLowerCase() === name.toLowerCase());
  let next = current;
  let finalName = name;

  if (existing) {
    finalName = String(existing.name).trim();
    if (existing.status !== "Inactive") return finalName; // already there and active: nothing to save
    next = current.map((u) => (u === existing ? { ...u, status: "Active" as const } : u));
  } else {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
    // "unit-uom-" prefix: ids like "unit-kg" are filtered out by the Units screen as old presets.
    const id = `unit-uom-${slug}-${Date.now().toString(36)}`;
    next = [...current, { id, name, status: "Active" }];
  }

  await pushSharedSetting(KEY, next); // throws the server's message (e.g. no permission)
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent(`${KEY}_updated`, { detail: next }));
  } catch {
    // cache only; the server copy is the source of truth
  }
  return finalName;
}
