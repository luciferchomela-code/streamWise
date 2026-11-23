import { consumeQueue, publishEvent } from "../../shared/config/rabbitmq.js";
import { PlaybackBucket, PlaybackEvent } from "../models/playbackHealth.js";
import { withEventTransaction } from "./outbox.js";

const queue = {
  name: "streamwise.playback-health.v1",
  routingKey: "playback.telemetry.batch",
  options: { messageTtl: 86400_000, maxLength: 50_000, overflow: "reject-publish" },
};
export const bucketMs = 5 * 60_000;
export const playbackId = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const formats = ["hls", "mp4"];
const players = ["hls.js", "native"];
const eventCounters = {
  attempt: ["attempts"],
  startup: ["startups", "startupMs"],
  rebuffer: ["rebuffers", "rebufferMs"],
  error: ["failures"],
  fallback: ["fallbacks"],
  delivery: ["deliveries", "deliveryMs"],
};

export function browserFamily(agent = "") {
  if (/Edg(?:e|A|iOS)?\//.test(agent)) return "Edge";
  if (/(?:Firefox|FxiOS)\//.test(agent)) return "Firefox";
  if (/(?:Chrome|CriOS)\//.test(agent)) return "Chrome";
  if (/Safari\//.test(agent)) return "Safari";
  return "Other";
}

export function validateBatch(input, agent, now = Date.now()) {
  if (!Array.isArray(input) || !input.length || input.length > 25) return null;
  const browser = browserFamily(agent);
  const seen = new Set();
  const events = [];
  for (const event of input) {
    if (!event || typeof event.eventId !== "string" || !playbackId.test(event.eventId) ||
        typeof event.sessionId !== "string" || !playbackId.test(event.sessionId) ||
        typeof event.videoId !== "string" || !/^[0-9a-f]{24}$/i.test(event.videoId) ||
        typeof event.type !== "string" || !Object.hasOwn(eventCounters, event.type) || !formats.includes(event.format) ||
        !players.includes(event.player) || (event.player === "hls.js" && event.format !== "hls") ||
        !Number.isSafeInteger(event.timestamp) || event.timestamp < now - 86400_000 ||
        event.timestamp > now + 60_000) return null;
    if (eventCounters[event.type].length === 2 && (!Number.isSafeInteger(event.durationMs) ||
        event.durationMs < 0 || event.durationMs > 600_000)) return null;
    const id = event.eventId.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    const code = ["error", "fallback"].includes(event.type) && typeof event.code === "string" && /^[a-z0-9_-]{1,40}$/i.test(event.code)
      ? event.code : undefined;
    const bucketTimestamp = event.type === "error" && Number.isSafeInteger(event.attemptedAt) &&
      event.attemptedAt >= now - 86400_000 && event.attemptedAt <= event.timestamp ? Math.min(now, event.attemptedAt) : undefined;
    events.push({ _id: id, sessionId: event.sessionId.toLowerCase(), videoId: event.videoId.toLowerCase(),
      type: event.type, format: event.format, player: event.player, browser, code,
      timestamp: Math.min(event.timestamp, now), bucketTimestamp,
      durationMs: eventCounters[event.type].length === 2 ? event.durationMs : undefined });
  }
  return events;
}

export const enqueuePlayback = (events, requestId) =>
  publishEvent(queue.routingKey, { events, requestId, receivedAt: Date.now() }, { queue });

export async function storePlayback({ events, requestId, receivedAt }) {
  await withEventTransaction(async (session) => {
    const result = await PlaybackEvent.bulkWrite(events.map(({ bucketTimestamp, ...event }) => ({ updateOne: {
      filter: { _id: event._id }, update: { $setOnInsert: { ...event, requestId, receivedAt } }, upsert: true,
    } })), { session });
    const buckets = new Map();
    for (const index of Object.keys(result.upsertedIds)) {
      const event = events[index];
      const startsAt = Math.floor((event.bucketTimestamp ?? event.timestamp) / bucketMs) * bucketMs;
      const id = [startsAt, event.browser, event.player, event.format].join(":");
      if (!buckets.has(id)) buckets.set(id, {
        dimensions: { startsAt, browser: event.browser, player: event.player, format: event.format }, counts: {},
      });
      const { counts } = buckets.get(id);
      const [counter, duration] = eventCounters[event.type];
      counts[counter] = (counts[counter] || 0) + 1;
      if (duration) counts[duration] = (counts[duration] || 0) + event.durationMs;
    }
    if (buckets.size) await PlaybackBucket.bulkWrite([...buckets].map(([_id, { dimensions, counts }]) => ({
      updateOne: { filter: { _id }, update: { $setOnInsert: dimensions, $inc: counts }, upsert: true },
    })), { session });
  });
}

export function startPlaybackConsumer() {
  const connect = async () => {
    try {
      await consumeQueue(queue, (channel, message) => {
        let batch;
        try {
          batch = JSON.parse(message.content);
          if (!Array.isArray(batch.events) || !batch.events.length || batch.events.length > 25 ||
              batch.events.some((event) => !eventCounters[event?.type])) throw new Error("Invalid playback message");
        } catch {
          channel.nack(message, false, false);
          return;
        }
        void storePlayback(batch).then(() => channel.ack(message)).catch((error) => {
          console.warn("[playback-worker]", batch.requestId, error.message);
          setTimeout(() => {
            try { channel.nack(message, false, true); } catch { /* A closed channel already requeues unacked messages. */ }
          }, 2000);
        });
      }, () => setTimeout(connect, 3000));
    } catch (error) {
      console.warn("[playback-worker]", error.message);
      setTimeout(connect, 3000);
    }
  };
  void connect();
}
