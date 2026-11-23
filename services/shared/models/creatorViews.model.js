import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: String,
  channelId: { type: mongoose.Schema.Types.ObjectId, required: true },
  day: { type: Date, required: true },
  bucket: { type: Number, required: true },
  views: { type: Number, default: 0 },
});
schema.index({ channelId: 1, day: 1 });
export default mongoose.model("CreatorViews", schema);
