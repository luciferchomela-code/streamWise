import express, { Router } from "express";
import OutboxEvent from "../../shared/models/outbox.model.js";
import { verifyGatewaySignature } from "../../shared/utils/gatewaySignature.js";
import { PlaybackBucket, PlaybackEvent, UploadProcessingRun } from "../models/playbackHealth.js";
import { requireGatewayIdentity } from "../middlewares/requireGatewayIdentity.js";
import handler from "../middlewares/tryCatch.js";
import { bucketMs, enqueuePlayback, playbackId, validateBatch } from "../utils/playbackHealth.js";
import { getRedisClient } from "../utils/redisCache.js";

const router = Router();
const windows = { "1h": 12, "24h": 288, "7d": 2016, "30d": 8640 };
const fields = ["attempts", "startups", "startupMs", "rebuffers", "rebufferMs", "errors", "fallbacks", "deliveries", "deliveryMs"];
const counters = Object.fromEntries(fields.map((field) => [field, { $sum: field === "errors" ? "$failures" : `$${field}` }]));

router.post("/events", express.text({ limit: "16kb", type: "text/plain" }), handler(async (req, res) => {
  const requestId = req.get("x-request-id");
  if (!verifyGatewaySignature({ requestId, timestamp: req.get("x-gateway-timestamp"), signature: req.get("x-gateway-signature") })) {
    return res.sendStatus(403);
  }
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.sendStatus(400); }
  }
  const events = validateBatch(body?.events, req.get("user-agent"));
  if (!events) return res.status(400).json({ message: "Invalid playback events." });
  if (!await enqueuePlayback(events, requestId)) return res.sendStatus(503);
  res.sendStatus(202);
}));

router.use(requireGatewayIdentity, (req, res, next) => {
  const allowed = (process.env.PLAYBACK_OPERATOR_USER_IDS || "").split(",").some((id) => id.trim() === req.auth.userId);
  if (!allowed) return res.status(403).json({ message: "Playback health requires operator access." });
  res.set("Cache-Control", "private, no-store");
  next();
});

router.get("/sessions/:id", handler(async (req, res) => {
  if (!playbackId.test(req.params.id)) return res.sendStatus(400);
  const events = await PlaybackEvent.find({ sessionId: req.params.id.toLowerCase(), receivedAt: { $gte: new Date(Date.now() - 2 * 86400_000) } })
    .select("timestamp type format player code durationMs requestId").sort({ timestamp: 1 }).limit(60).lean();
  if (!events.length) return res.status(404).json({ message: "Playback session is no longer available." });
  res.json({ events });
}));

async function gatewayHealth(start, end, step) {
  const redis = await getRedisClient();
  if (!redis) return null;
  try {
    const totals = new Map();
    for (let from = Math.max(start, end - windows["24h"] * bucketMs); from < end; from += bucketMs * 288) {
      const times = Array.from({ length: Math.min(288, (end - from) / bucketMs) }, (_, index) => from + index * bucketMs);
      const rows = await Promise.all(times.map((time) => redis.hGetAll(`streamwise:gateway-health:${time}`)));
      rows.forEach((row, index) => {
        if (!row.requests) return;
        const time = start + Math.floor((times[index] - start) / step) * step;
        if (!totals.has(time)) totals.set(time, { time, requests: 0, durationMs: 0, errors: 0 });
        const output = totals.get(time);
        output.requests += Number(row.requests);
        output.durationMs += Number(row.durationMs);
        output.errors += Number(row.errors);
      });
    }
    const reportingFrom = Math.max(start, end - windows["24h"] * bucketMs);
    return [...totals.values()].map((row) => {
      const durationMinutes = Math.max(1, (Math.min(row.time + step, Date.now()) - Math.max(row.time, reportingFrom)) / 60_000);
      return { ...row, requestsPerMinute: row.requests / durationMinutes };
    });
  } catch {
    return null;
  }
}

router.get("/", handler(async (req, res) => {
  const window = req.query.window || "1h";
  if (typeof window !== "string" || !Object.hasOwn(windows, window)) {
    return res.status(400).json({ message: "Unknown playback health window." });
  }
  const end = (Math.floor(Date.now() / bucketMs) + 1) * bucketMs;
  const start = end - windows[window] * bucketMs;
  const step = bucketMs * ({ "1h": 1, "24h": 6, "7d": 36, "30d": 144 }[window]);
  const offset = { $subtract: [{ $toLong: "$startsAt" }, start] };
  const [playback, recentErrors, outbox, uploads, gateway] = await Promise.all([
    PlaybackBucket.aggregate([
      { $match: { startsAt: { $gte: new Date(start), $lt: new Date(end) } } },
      { $facet: {
        series: [{ $group: { _id: { $subtract: [{ $toLong: "$startsAt" }, { $mod: [offset, step] }] }, ...counters } }, { $sort: { _id: 1 } }],
        breakdown: [{ $group: { _id: { browser: "$browser", player: "$player", format: "$format" }, ...counters } },
          { $sort: { attempts: -1, errors: -1, startups: -1 } }],
      } },
    ]),
    PlaybackEvent.find({ type: { $in: ["error", "fallback"] }, receivedAt: { $gte: new Date(Math.max(start, Date.now() - 2 * 86400_000)) } })
      .select("sessionId videoId timestamp type browser player format code requestId").sort({ receivedAt: -1 }).limit(20).lean(),
    OutboxEvent.aggregate([
      { $match: { availableAt: { $type: "date" } } },
      { $group: { _id: null, pending: { $sum: 1 }, oldest: { $min: "$occurredAt" } } },
    ]),
    UploadProcessingRun.aggregate([
      { $match: { finishedAt: { $gte: new Date(start) } } },
      { $group: { _id: null, completed: { $sum: 1 }, failed: { $sum: { $cond: ["$failed", 1, 0] } },
        averageMs: { $avg: "$durationMs" } } },
      { $project: { _id: 0 } },
    ]),
    gatewayHealth(start, end, step),
  ]);
  res.json({
    ...playback[0], recentErrors, gateway, start, end, step, uploads: uploads[0] || { completed: 0, failed: 0, averageMs: null },
    outbox: { pending: outbox[0]?.pending || 0,
      oldestAgeSeconds: outbox[0] ? Math.max(0, Math.floor((Date.now() - +outbox[0].oldest) / 1000)) : 0 },
  });
}));

export default router;
