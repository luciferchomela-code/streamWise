import mongoose from "mongoose";
const { Schema } = mongoose;

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
    thumbnailUrl: {
      type: String,
      default: null,
    },
    videoUrl: {
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
      enum: ["draft", "uploading", "ready", "published", "failed"],
      default: "draft",
      index: true,
    },
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
const Video = mongoose.model("Video", videoSchema);

export default Video;