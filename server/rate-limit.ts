type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Simple in-memory limiter. key = ip:action */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (cur.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }
  cur.count += 1;
  return { ok: true };
}

export function clientIp(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }) {
  const xf = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    ?.trim();
  if (xf) return xf.slice(0, 64);
  return String(req.socket?.remoteAddress || "unknown").slice(0, 64);
}

/** Opportunistic cleanup so the map does not grow forever on long-lived preview. */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}, 60_000).unref?.();
