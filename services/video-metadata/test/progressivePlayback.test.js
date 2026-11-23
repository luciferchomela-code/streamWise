import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import mongoose from "mongoose";
import Video from "../../shared/models/video.model.js";
import { PlaybackBucket, PlaybackEvent } from "../models/playbackHealth.js";
import { processEnhancement, queueEnhancements, verifyManifest } from "../utils/publishing.js";
import { bucketMs, storePlayback, validateBatch } from "../utils/playbackHealth.js";

test("an HLS manifest only becomes ready when its variant and first segment respond", async (t) => {
  const base = "https://video.example/baseline.m3u8";
  const files = new Map([
    [base, "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=200000\nlow/index.m3u8"],
    ["https://video.example/low/index.m3u8", "#EXTM3U\n#EXTINF:2.0,\nfirst.ts"],
  ]);
  t.mock.method(globalThis, "fetch", async (url) => {
    const content = files.get(String(url));
    return content ? new Response(content) : new Response("processing", { status: 404 });
  });
  assert.equal(await verifyManifest(base), false);
  files.set("https://video.example/low/first.ts", "first segment");
  assert.equal(await verifyManifest(base), true);
});

test("the adaptive stage checks the higher rendition and thumbnail generation respects an uploaded poster", async (t) => {
  const now = new Date();
  assert.deepEqual(queueEnhancements({ thumbnailUrl: "custom" }, now), {
    adaptive: { state: "pending", dueAt: now },
    thumbnail: { state: "ready" },
    storyboard: { state: "pending", dueAt: now },
  });
  const base = "https://video.example/adaptive.m3u8";
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    if (String(url) === base) return new Response(
      "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100\nld.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=200\nhd.m3u8");
    return new Response("processing", { status: 404 });
  });
  assert.equal(await verifyManifest(base, { adaptive: true }), false);
  assert.equal(String(fetch.mock.calls[1].arguments[0]), "https://video.example/hd.m3u8");
});

test("an exhausted enhancement only marks that enhancement failed", async (t) => {
  const video = { _id: "id", publishing: { thumbnail: { attempts: 12 } },
    processingAsset: { thumbnailUrl: "https://video.example/poster.jpg" } };
  t.mock.method(Video, "findOneAndUpdate", () => ({ select: () => video }));
  t.mock.method(globalThis, "fetch", async () => new Response("missing", { status: 404 }));
  t.mock.method(console, "warn", () => {});
  const write = t.mock.method(Video, "updateOne", async () => ({ modifiedCount: 1 }));
  await processEnhancement("thumbnail", () => assert.fail("A failed asset did not change playback"));
  const [filter, update] = write.mock.calls[0].arguments;
  assert.deepEqual(filter.status, { $in: ["ready", "published"] });
  assert.deepEqual(Object.keys(update.$set), ["publishing.thumbnail"]);
  assert.equal(update.$set["publishing.thumbnail"].state, "failed");
});

test("playback retries preserve event identity and count only new events in the rollup", async (t) => {
  const timestamp = 1_800_000_000_001;
  const base = { sessionId: randomUUID(), timestamp, videoId: "1234567890abcdef12345678", format: "hls", player: "hls.js" };
  const attempt = { ...base, eventId: randomUUID(), type: "attempt" };
  const startup = { ...base, eventId: randomUUID(), type: "startup", durationMs: 350 };
  const events = validateBatch([attempt, attempt, startup], "Mozilla/5.0 Chrome/120.0", timestamp);
  assert.equal(events.length, 2);
  assert.equal(events[0].browser, "Chrome");
  assert.equal(validateBatch([{ ...startup, durationMs: -1 }], "", timestamp), null);

  const session = {};
  t.mock.method(mongoose.connection, "transaction", async (work) => work(session));
  t.mock.method(PlaybackEvent, "bulkWrite", async () => ({ upsertedIds: { 1: startup.eventId } }));
  const rollup = t.mock.method(PlaybackBucket, "bulkWrite", async () => {});
  await storePlayback({ events, requestId: randomUUID(), receivedAt: timestamp });
  const [[operation], options] = rollup.mock.calls[0].arguments;
  assert.equal(options.session, session);
  assert.deepEqual(operation.updateOne.update.$inc, { startups: 1, startupMs: 350 });
  assert.equal(operation.updateOne.update.$setOnInsert.startsAt, Math.floor(timestamp / bucketMs) * bucketMs);
});
