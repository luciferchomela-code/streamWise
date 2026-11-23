import test from "node:test";
import assert from "node:assert/strict";
import { LiveStreamStressTest, formatStressReport } from "./live-spike.js";

test("Live Traffic Stress Test: simulates spike, records p95/p99 delays and recovery", async () => {
  const runner = new LiveStreamStressTest({
    subscriberCount: 500,
    chatMessageRate: 100,
    durationSeconds: 1,
    batchWindowMs: 40,
  });

  const metrics = await runner.run();
  assert.equal(metrics.subscriberCount, 500);
  assert.equal(metrics.notificationsDispatched, 500);
  assert.ok(metrics.chatMessagesGenerated > 0);
  assert.ok(metrics.chatBatchesDelivered > 0);
  assert.ok(metrics.packetsSavedPercent > 50); // Compaction saves over 50% packets
  assert.ok(metrics.p95DelayMs < 250); // p95 latency under 250ms
  assert.ok(metrics.recoveryTimeMs >= 0);

  const report = formatStressReport(metrics);
  assert.ok(report.includes("LIVE TRAFFIC & NOTIFICATION STRESS-TEST REPORT"));
  assert.ok(report.includes("Chat Delivery Latency"));
});
