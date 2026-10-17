/**
 * Best-effort, in-memory, per-key fixed-window rate limiter.
 *
 * On Vercel each warm serverless instance keeps its own Map, so the limit is per instance,
 * not global: an attacker spread across instances gets (limit x instances). It still blunts
 * single-source brute force for free; the per-account lockout remains the hard guarantee.
 * For a global limit later, swap the Map for Upstash Redis / Vercel KV with the same API.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export function rateLimitHit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    if (buckets.size > MAX_KEYS) buckets.clear();
  }
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return { allowed, remaining: Math.max(0, limit - bucket.count), retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
}

/** Client IP as seen by Vercel's edge (first x-forwarded-for hop), falling back to x-real-ip. */
export function clientIp(headers: Headers) {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** 10 sign-in attempts per IP per 5 minutes, per login surface. */
export function loginRateLimit(surface: "erp" | "mobile", headers: Headers) {
  return rateLimitHit(`login:${surface}:${clientIp(headers)}`, 10, 5 * 60 * 1000);
}
