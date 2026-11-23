import mongoose from "mongoose";
const { Schema } = mongoose;
const publishingStage = new Schema({
  state: { type: String, enum: ["pending", "processing", "ready", "failed"] },
  dueAt: { type: Date, select: false },
  claim: { type: String, select: false },
  attempts: { type: Number, select: false },
  error: String,
}, { _id: false });

const videoSchema = new Schema(
  {
    channelId: {
      type: Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    category: {
      type: String,
      default: "General",
    },
    thumbnailUrl: {
      type: String,
      default: null,
    },
    videoUrl: {
      type: String,
      default: null,
    },
    hlsUrl: {
      type: String,
      default: null,
    },
    publicId: {
      type: String,   // Cloudinary public_id — used for deletion
      default: null,
    },
    duration: {
      type: Number,
      default: null,
      min: 0,
    },
    visibility: {
      type: String,
      enum: ["public", "private", "unlisted"],
      default: "public",
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "uploading", "processing", "ready", "published", "failed", "moderated"],
      default: "draft",
      index: true,
    },
    processingAt: Date,
    processingClaim: String,
    processingAttempts: Number,
    processingError: String,
    processingAsset: { type: Object, select: false },
    processingRequestId: { type: String, select: false },
    processingQueuedAt: { type: Date, select: false },
    publishing: {
      adaptive: publishingStage,
      thumbnail: publishingStage,
      storyboard: publishingStage,
    },
    storyboard: [{ _id: false, time: Number, url: String }],
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    likes:{
        type:Number,
        default:0,
        min:0
    },
    dislikes:{
        type:Number,
        default:0,
        min:0
    }
  },
  { timestamps: true }
);

videoSchema.index({ visibility: 1, status: 1, createdAt: -1 });

videoSchema.index({
  channelId: 1,
  visibility: 1,
  status: 1,
  createdAt: -1,
});

videoSchema.index({ title: "text", description: "text", tags: "text" });

videoSchema.index({
  category: 1,
  visibility: 1,
  status: 1,
  createdAt: -1,
});
videoSchema.index({ status: 1, processingAt: 1, _id: 1 });
for (const stage of ["adaptive", "thumbnail", "storyboard"]) {
  videoSchema.index({ status: 1, [`publishing.${stage}.dueAt`]: 1, _id: 1 },
    { partialFilterExpression: { [`publishing.${stage}.dueAt`]: { $type: "date" } } });
}
videoSchema.index({ channelId: 1, _id: -1 });
videoSchema.index({ channelId: 1, views: -1, _id: -1 });
const Video = mongoose.model("Video", videoSchema);

export default Video;
