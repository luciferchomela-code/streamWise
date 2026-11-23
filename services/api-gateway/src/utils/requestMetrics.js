const bucketMs = 5 * 60_000;

export function trackGatewayRequests(redis, enabled) {
  const buckets = new Map();
  if (enabled) {
    setInterval(() => {
      if (!redis.isReady || !buckets.size) return;
      const transaction = redis.multi();
      for (const [time, totals] of buckets) {
        const key = `streamwise:gateway-health:${time}`;
        transaction.hIncrBy(key, "requests", totals.requests);
        transaction.hIncrBy(key, "durationMs", totals.durationMs);
        transaction.hIncrBy(key, "errors", totals.errors);
        transaction.expire(key, 25 * 3600);
      }
      buckets.clear();
      void transaction.exec().catch((error) => console.warn("[gateway-metrics]", error.message));
    }, 10_000).unref();
  }
  return (req, res, next) => {
    const path = req.path;
    if (!path.startsWith("/api/")) return next();
    const started = performance.now();
    res.once("finish", () => {
      const durationMs = Math.round(performance.now() - started);
      if (enabled && redis.isReady) {
        const time = Math.floor(Date.now() / bucketMs) * bucketMs;
        if (!buckets.has(time)) buckets.set(time, { requests: 0, durationMs: 0, errors: 0 });
        const totals = buckets.get(time);
        totals.requests++;
        totals.durationMs += durationMs;
        if (res.statusCode >= 500) totals.errors++;
      }
      if (res.statusCode >= 500 || (req.method === "PATCH" && /^\/api\/videos\/[^/]+\/finalize$/.test(path))) {
        console.info(JSON.stringify({ service: "api-gateway", event: "http.complete", requestId: req.requestId,
          method: req.method, status: res.statusCode, durationMs }));
      }
    });
    next();
  };
}
