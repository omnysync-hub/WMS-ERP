/**
 * Validation for user-supplied receipt / attachment URLs.
 * Two accepted forms:
 *  - https URLs on known storage hosts, capped in length. This blocks `javascript:`
 *    payloads and arbitrary tracking hosts from being stored and later rendered in the ERP.
 *    Extra hosts: env RECEIPT_URL_ALLOWED_HOSTS="host1,*.host2".
 *  - Inline `data:image/jpeg|png|webp;base64` photos (the technician app attaches a receipt
 *    photo directly, mirroring job completion photos), capped at the same per-photo size
 *    limit JobsService.completeJob enforces for completion photos.
 */
export const RECEIPT_URL_MAX_LENGTH = 2048;

/** Per-photo cap for inline data-image receipts — matches the completion-photo cap in JobsService.completeJob. */
export const RECEIPT_DATA_URL_MAX_LENGTH = 2_700_000;

const DATA_IMAGE_RECEIPT_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

const DEFAULT_ALLOWED_HOSTS = [
  "*.public.blob.vercel-storage.com",
  "res.cloudinary.com",
  "*.supabase.co",
  "hvac-erp-bay.vercel.app",
];

function allowedHosts(): string[] {
  const extra = (process.env.RECEIPT_URL_ALLOWED_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_HOSTS, ...extra];
}

function hostMatches(host: string, pattern: string) {
  if (pattern.startsWith("*.")) {
    const base = pattern.slice(2);
    return host === base || host.endsWith(`.${base}`);
  }
  return host === pattern;
}

/** Returns `{ ok: true, value }` (value null when empty) or `{ ok: false, error }`. */
export function validateReceiptUrl(input: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (input === undefined || input === null || input === "") return { ok: true, value: null };
  if (typeof input !== "string") return { ok: false, error: "Receipt URL must be a string." };
  const raw = input.trim();
  if (!raw) return { ok: true, value: null };
  // Inline receipt photo captured by the technician app (no hosted upload exists).
  if (raw.startsWith("data:")) {
    if (raw.length > RECEIPT_DATA_URL_MAX_LENGTH) {
      return { ok: false, error: "Receipt photo is too large." };
    }
    const match = DATA_IMAGE_RECEIPT_PATTERN.exec(raw);
    if (!match || match[1].length % 4 === 1) {
      return { ok: false, error: "Receipt photo must be a base64 JPEG, PNG or WebP image." };
    }
    return { ok: true, value: raw };
  }
  if (raw.length > RECEIPT_URL_MAX_LENGTH) return { ok: false, error: "Receipt URL is too long." };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "Receipt URL is not a valid URL." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Receipt URL must use https." };
  if (url.username || url.password) return { ok: false, error: "Receipt URL must not contain credentials." };
  const host = url.hostname.toLowerCase();
  if (!allowedHosts().some((p) => hostMatches(host, p))) {
    return { ok: false, error: `Receipt host '${host}' is not an approved storage location.` };
  }
  return { ok: true, value: url.toString() };
}

/**
 * Validates an array of receipt photos (or a single photo string), returning the
 * valid URLs / data URLs. Each entry goes through validateReceiptUrl, so hosted
 * URLs follow the allow-list rules and inline photos the data-URL size cap.
 * Used by the mobile expenses route, which accepts up to 10 photos per expense.
 */
export function validateReceiptPhotos(input: unknown): { ok: true; values: string[] } | { ok: false; error: string } {
  if (!input) return { ok: true, values: [] };
  const list = Array.isArray(input) ? input : [input];
  if (list.length > 10) {
    return { ok: false, error: "Cannot attach more than 10 photos per expense." };
  }
  const values: string[] = [];
  for (let i = 0; i < list.length; i++) {
    const res = validateReceiptUrl(list[i]);
    if (!res.ok) {
      return { ok: false, error: `Photo #${i + 1}: ${res.error}` };
    }
    if (res.value) {
      values.push(res.value);
    }
  }
  return { ok: true, values };
}
