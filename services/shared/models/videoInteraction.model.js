import mongoose from "mongoose";

const { Schema } = mongoose;

const videoInteractionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    videoId: {
      type: Schema.Types.ObjectId,
      ref: "Video",
      required: true,
      index: true,
    },

    liked: {
      type: Boolean,
      default: false,
    },
    disliked: {
      type: Boolean,
      default: false,
    },

    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    watchPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lastViewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

videoInteractionSchema.index({ userId: 1, videoId: 1 }, { unique: true });

videoInteractionSchema.index({ userId: 1, lastViewedAt: -1 });

videoInteractionSchema.index({ userId: 1, liked: 1, updatedAt: -1 });

videoInteractionSchema.index({ userId: 1, disliked: 1, updatedAt: -1 });



const VideoInteraction = mongoose.model(
  "VideoInteraction",
  videoInteractionSchema
);

export default VideoInteraction;