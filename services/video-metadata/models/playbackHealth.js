import mongoose from "mongoose";

const event = new mongoose.Schema({
  _id: String,
  sessionId: String,
  videoId: String,
  type: String,
  format: String,
  browser: String,
  player: String,
  timestamp: Date,
  durationMs: Number,
  code: String,
  receivedAt: { type: Date, expires: 2 * 86400 },
  requestId: String,
});
event.index({ type: 1, receivedAt: -1 });
event.index({ sessionId: 1, timestamp: 1 });

const bucket = new mongoose.Schema({
  _id: String,
  startsAt: { type: Date, expires: 30 * 86400 },
  browser: String,
  player: String,
  format: String,
  attempts: Number,
  startups: Number,
  startupMs: Number,
  rebuffers: Number,
  rebufferMs: Number,
  failures: Number,
  fallbacks: Number,
  deliveries: Number,
  deliveryMs: Number,
});

export const PlaybackEvent = mongoose.model("PlaybackEvent", event);
export const PlaybackBucket = mongoose.model("PlaybackBucket", bucket);

const uploadRun = new mongoose.Schema({
  _id: String,
  finishedAt: { type: Date, expires: 30 * 86400 },
  failed: Boolean,
  durationMs: Number,
});

export const UploadProcessingRun = mongoose.model("UploadProcessingRun", uploadRun);
