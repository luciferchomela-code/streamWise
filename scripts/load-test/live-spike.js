/**
 * Live Stream Concurrency & Subscriber Notification Stress-Test Simulator.
 * Simulates a creator going live, massive subscriber notification fan-out,
 * concurrent room joins, and high-velocity chat delivery.
 */

export class LiveStreamStressTest {
  constructor({
    subscriberCount = 1000,
    chatMessageRate = 200, // messages per second
    durationSeconds = 3,
    batchWindowMs = 50, // 50ms message compaction window
  } = {}) {
    this.subscriberCount = subscriberCount;
    this.chatMessageRate = chatMessageRate;
    this.durationSeconds = durationSeconds;
    this.batchWindowMs = batchWindowMs;
  }

  async run() {
    const startTime = Date.now();
    const metrics = {
      subscriberCount: this.subscriberCount,
      notificationsDispatched: 0,
      notificationDispatchTimeMs: 0,
      peakNotificationBacklog: 0,
      chatMessagesGenerated: 0,
      chatBatchesDelivered: 0,
      chatDeliveryDelaysMs: [],
      recoveryTimeMs: 0,
    };

    // 1. Simulate Notification Fan-Out (Chunked Batches of 200)
    const notifStart = Date.now();
    let remainingSubscribers = this.subscriberCount;
    const CHUNK_SIZE = 200;
    let backlog = this.subscriberCount;

    while (remainingSubscribers > 0) {
      const currentBatch = Math.min(CHUNK_SIZE, remainingSubscribers);
      metrics.peakNotificationBacklog = Math.max(metrics.peakNotificationBacklog, backlog);
      
      // Simulate chunk dispatch to RabbitMQ / Push Gateway
      await new Promise(r => setTimeout(r, 10)); // 10ms per batch
      metrics.notificationsDispatched += currentBatch;
      remainingSubscribers -= currentBatch;
      backlog -= currentBatch;
    }
    metrics.notificationDispatchTimeMs = Date.now() - notifStart;

    // 2. Simulate Concurrent Chat Ingestion & Compaction
    const chatStart = Date.now();
    const chatEndTime = chatStart + this.durationSeconds * 1000;
    let messageBuffer = [];
    let lastFlushTime = Date.now();

    const intervalMs = Math.max(1, Math.floor(1000 / this.chatMessageRate));
    let nextMessageTime = chatStart;

    while (Date.now() < chatEndTime) {
      const now = Date.now();
      if (now >= nextMessageTime) {
        messageBuffer.push({
          id: `msg_${metrics.chatMessagesGenerated}`,
          userId: `user_${Math.floor(Math.random() * this.subscriberCount)}`,
          text: "Let's go stream!",
          sentAt: now,
        });
        metrics.chatMessagesGenerated++;
        nextMessageTime += intervalMs;
      }

      // Compact & Flush batch if window elapsed
      if (now - lastFlushTime >= this.batchWindowMs && messageBuffer.length > 0) {
        const batchToDeliver = [...messageBuffer];
        messageBuffer = [];
        const flushTime = Date.now();

        // Calculate delivery delay for messages in this batch
        for (const msg of batchToDeliver) {
          const delay = flushTime - msg.sentAt;
          metrics.chatDeliveryDelaysMs.push(delay);
        }

        metrics.chatBatchesDelivered++;
        lastFlushTime = flushTime;
      }

      await new Promise(r => setTimeout(r, 2));
    }

    // Flush any leftover messages in buffer
    if (messageBuffer.length > 0) {
      const flushTime = Date.now();
      for (const msg of messageBuffer) {
        metrics.chatDeliveryDelaysMs.push(flushTime - msg.sentAt);
      }
      metrics.chatBatchesDelivered++;
    }

    // 3. Recovery Time: Time from spike end until buffers are 0
    metrics.recoveryTimeMs = Date.now() - chatEndTime;

    // Calculate percentiles
    metrics.chatDeliveryDelaysMs.sort((a, b) => a - b);
    const count = metrics.chatDeliveryDelaysMs.length || 1;
    metrics.p50DelayMs = metrics.chatDeliveryDelaysMs[Math.floor(count * 0.50)] || 0;
    metrics.p95DelayMs = metrics.chatDeliveryDelaysMs[Math.floor(count * 0.95)] || 0;
    metrics.p99DelayMs = metrics.chatDeliveryDelaysMs[Math.floor(count * 0.99)] || 0;
    metrics.packetsSavedPercent = Math.round(
      ((metrics.chatMessagesGenerated - metrics.chatBatchesDelivered) / Math.max(1, metrics.chatMessagesGenerated)) * 100
    );

    return metrics;
  }
}

export function formatStressReport(metrics) {
  return [
    "==================================================================",
    "          LIVE TRAFFIC & NOTIFICATION STRESS-TEST REPORT",
    "==================================================================",
    `Simulated Concurrent Subscribers : ${metrics.subscriberCount}`,
    `Notifications Dispatched        : ${metrics.notificationsDispatched} in ${metrics.notificationDispatchTimeMs}ms`,
    `Peak Notification Queue Backlog  : ${metrics.peakNotificationBacklog}`,
    "------------------------------------------------------------------",
    `Chat Messages Simulated         : ${metrics.chatMessagesGenerated}`,
    `Chat Batches Emitted             : ${metrics.chatBatchesDelivered}`,
    `Network Packets Saved via Batch  : ${metrics.packetsSavedPercent}%`,
    "------------------------------------------------------------------",
    `Chat Delivery Latency (p50)      : ${metrics.p50DelayMs}ms`,
    `Chat Delivery Latency (p95)      : ${metrics.p95DelayMs}ms`,
    `Chat Delivery Latency (p99)      : ${metrics.p99DelayMs}ms`,
    `System Recovery Drain Time       : ${metrics.recoveryTimeMs}ms`,
    "==================================================================",
  ].join("\n");
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  console.log("Starting Live Traffic Stress Test...");
  const runner = new LiveStreamStressTest({ subscriberCount: 1000, chatMessageRate: 200, durationSeconds: 3 });
  runner.run().then(m => console.log(formatStressReport(m)));
}
