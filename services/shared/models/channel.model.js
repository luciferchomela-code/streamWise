import mongoose from "mongoose";

const { Schema } = mongoose;

const channelSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    handle: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 50,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    category: {
      type: String,
      default: "General",
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    image: {
      type: String,
      default: null,
    },
    subscribersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

const Channel = mongoose.model("Channel", channelSchema);

export default Channel;