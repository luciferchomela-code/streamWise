import mongoose from "mongoose";
const { Schema } = mongoose;

const playbackTelemetrySchema = new Schema(
  {
    videoId: {
      type: Schema.Types.ObjectId,
      ref: "Video",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    ttffMs: { type: Number, default: 0 },
    totalStallMs: { type: Number, default: 0 },
    totalWatchDurationMs: { type: Number, default: 0 },
    rebufferRatio: { type: Number, default: 0 },
    startFailed: { type: Boolean, default: false },
    browser: { type: String, default: "unknown" },
    resolution: { type: String, default: "auto" },
    networkType: { type: String, default: "unknown" },
  },
  { timestamps: true }
);

playbackTelemetrySchema.index({ createdAt: -1 });
playbackTelemetrySchema.index({ browser: 1, resolution: 1 });

const PlaybackTelemetry = mongoose.model("PlaybackTelemetry", playbackTelemetrySchema);
export default PlaybackTelemetry;
