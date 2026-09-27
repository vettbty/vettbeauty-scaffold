/**
 * Per-instance sliding-window limiter.
 *
 * Files under /api whose name starts with an underscore are not routed by
 * Vercel, so this is a shared module rather than an endpoint.
 *
 * Honest about what it is: serverless instances are ephemeral and there may be
 * several at once, so the real ceiling is (limit x live instances), not limit.
 * It stops a single client hammering one instance, which is the realistic
 * abuse here; it is not a distributed quota. If this endpoint ever gets found
 * properly, the right answer is a Vercel Firewall rate-limit rule (available on
 * Pro) in front of the function, not a cleverer version of this.
 */
const hits = new Map();

export function rateLimit(req, { limit = 5, windowMs = 60_000 } = {}) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  const now = Date.now();

  const recent = (hits.get(ip) || []).filter(t => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);

  // Opportunistic sweep so the map cannot grow without bound on a warm instance.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.some(t => now - t < windowMs)) hits.delete(k);
    }
  }

  return {
    ok: recent.length <= limit,
    retryAfter: Math.ceil(windowMs / 1000),
  };
}
