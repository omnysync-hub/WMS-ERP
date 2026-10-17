/**
 * Validation for user-supplied receipt / attachment URLs.
 * Only https URLs on known storage hosts are accepted, capped in length. This blocks
 * `javascript:`/`data:` payloads and arbitrary tracking hosts from being stored and later
 * rendered in the ERP. Extra hosts: env RECEIPT_URL_ALLOWED_HOSTS="host1,*.host2".
 */
export const RECEIPT_URL_MAX_LENGTH = 2048;

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
