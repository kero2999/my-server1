const bucketsByLimiter = new Map();

function getClientKey(req) {
  return String(req.ip || req.socket?.remoteAddress || "unknown").slice(0, 120);
}

function rateLimit({ windowMs = 15 * 60 * 1000, max = 100, name = "api", keyGenerator = getClientKey } = {}) {
  const buckets = new Map();
  bucketsByLimiter.set(name, buckets);

  const cleanup = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= cutoff) buckets.delete(key);
    }
  }, Math.min(windowMs, 60 * 1000));
  cleanup.unref?.();

  return function limiter(req, res, next) {
    if (req.method === "OPTIONS") return next();

    const rawKey = keyGenerator(req);
    const key = `${name}:${String(rawKey || "unknown").slice(0, 180)}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ ok: false, error: "محاولات كثيرة في وقت قصير. حاول مرة أخرى بعد قليل." });
    }

    next();
  };
}

module.exports = { rateLimit };
