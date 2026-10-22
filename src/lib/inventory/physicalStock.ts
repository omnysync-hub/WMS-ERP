/**
 * "Physical stock" = a warehouse product that is not a service. The Product table has no type
 * column, so this uses the same rule the mobile app already applies to find services:
 * SKU starting SRV-/SVC-, or a service-style unit (service, visit, job, hr, hour).
 */
const SERVICE_UNITS = new Set(["service", "visit", "job", "hr", "hour"]);

export function isServiceProduct(p: { sku?: string | null; unit?: string | null; isService?: boolean | null }): boolean {
  if (p.isService === true) return true;
  const sku = String(p.sku || "").toUpperCase();
  if (sku.startsWith("SRV-") || sku.startsWith("SVC-")) return true;
  return SERVICE_UNITS.has(String(p.unit || "").trim().toLowerCase());
}

export const isPhysicalProduct = (p: { sku?: string | null; unit?: string | null; isService?: boolean | null }) =>
  !isServiceProduct(p);

/** The app sends the line as "Name (SKU)"; pull the SKU back out. */
export function skuFromItemLabel(label: string): string | null {
  const m = /\(([^()]+)\)\s*$/.exec(String(label || "").trim());
  return m ? m[1].trim() : null;
}
