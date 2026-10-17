import crypto from "crypto";

/**
 * Internal actor headers stamped by middleware after it has verified the caller
 * (ERP DB session cookie or signed mobile Bearer token).
 *
 * Route handlers must never trust these headers on their own: they are only valid when the
 * HMAC in `x-workman-actor-sig` matches, which only the middleware (holding the server secret)
 * can produce. Middleware also strips any copy of these headers sent by the client.
 */
export const INTERNAL_ACTOR_HEADERS = [
  "x-workman-authenticated",
  "x-workman-actor-sig",
  "x-actor-role",
  "x-actor-name",
  "x-actor-overrides",
  "x-user-id",
  "x-user-role",
  "x-user-name",
  "x-employee-id",
] as const;

export type SignedActor = {
  id: string;
  role: string;
  name: string;
  overrides?: Record<string, boolean>;
};

function headerSecret(): string {
  const secret = process.env.ERP_HEADER_SECRET || process.env.MOBILE_AUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error("ERP_HEADER_SECRET / MOBILE_AUTH_SECRET is not configured; cannot sign actor headers.");
  }
  return secret.trim();
}

function encodeOverrides(overrides?: Record<string, boolean>): string {
  const clean: Record<string, boolean> = {};
  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    for (const [k, v] of Object.entries(overrides)) if (typeof v === "boolean") clean[k] = v;
  }
  return Buffer.from(JSON.stringify(clean), "utf8").toString("base64url");
}

function payload(id: string, role: string, name: string, overridesB64: string) {
  return `v1|${id}|${role}|${Buffer.from(name, "utf8").toString("base64url")}|${overridesB64}`;
}

function sign(data: string) {
  return crypto.createHmac("sha256", headerSecret()).update(data).digest("hex");
}

/** Remove every internal actor header (call before forwarding any request). */
export function stripActorHeaders(headers: Headers) {
  for (const h of INTERNAL_ACTOR_HEADERS) headers.delete(h);
}

/** Stamp verified actor headers + HMAC. Header values must be ASCII-safe, so name is URI-encoded. */
export function stampActorHeaders(headers: Headers, actor: SignedActor) {
  stripActorHeaders(headers);
  const role = String(actor.role || "").toLowerCase();
  const name = actor.name || "ERP User";
  const overridesB64 = encodeOverrides(actor.overrides);
  headers.set("x-workman-authenticated", "1");
  headers.set("x-actor-role", role);
  headers.set("x-actor-name", encodeURIComponent(name));
  headers.set("x-user-id", actor.id);
  headers.set("x-actor-overrides", overridesB64);
  headers.set("x-workman-actor-sig", sign(payload(actor.id, role, name, overridesB64)));
}

/** Returns the verified actor, or null when headers are missing or the signature is wrong. */
export function readSignedActor(headers: Headers): SignedActor | null {
  if (headers.get("x-workman-authenticated") !== "1") return null;
  const sig = headers.get("x-workman-actor-sig") || "";
  const id = headers.get("x-user-id") || "";
  const role = (headers.get("x-actor-role") || "").toLowerCase();
  const rawName = headers.get("x-actor-name") || "";
  const overridesB64 = headers.get("x-actor-overrides") || "";
  if (!sig || !id || !role) return null;
  let name = rawName;
  try {
    name = decodeURIComponent(rawName);
  } catch {
    return null;
  }
  let expected: string;
  try {
    expected = sign(payload(id, role, name, overridesB64));
  } catch {
    return null;
  }
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let overrides: Record<string, boolean> = {};
  try {
    const parsed = JSON.parse(Buffer.from(overridesB64, "base64url").toString("utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) overrides = parsed;
  } catch {
    overrides = {};
  }
  return { id, role, name, overrides };
}
