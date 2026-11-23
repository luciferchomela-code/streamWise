import mongoose from "mongoose";
const { Schema, model } = mongoose;
const id = (ref) => ({ type: Schema.Types.ObjectId, required: true, ...(ref ? { ref } : {}) });

const playlist = new Schema({
  ownerId: id("User"),
  name: { type: String, required: true, trim: true, maxlength: 100 },
}, { timestamps: true });
playlist.index({ ownerId: 1, _id: -1 });

const item = new Schema({ playlistId: id("Playlist"), videoId: id("Video") }, { timestamps: true });
item.index({ playlistId: 1, videoId: 1 }, { unique: true });
item.index({ playlistId: 1, _id: -1 });
item.index({ videoId: 1 });

const caption = new Schema({
  videoId: id("Video"),
  language: { type: String, required: true },
  label: { type: String, required: true },
  text: { type: String, required: true },
}, { timestamps: true });
caption.index({ videoId: 1, language: 1 }, { unique: true });

const report = new Schema({
  reporterId: id("User"),
  targetId: id(),
  videoId: id("Video"),
  kind: { type: String, enum: ["video", "comment"], required: true },
  reason: { type: String, required: true },
  state: { type: String, enum: ["open", "dismissed", "removed"], default: "open" },
  reviewerId: { type: Schema.Types.ObjectId },
  reviewedAt: Date,
}, { timestamps: true });
report.index({ reporterId: 1, kind: 1, targetId: 1 }, { unique: true });
report.index({ state: 1, _id: -1 });

const block = new Schema({ userId: id("User"), channelId: id("Channel") }, { timestamps: true });
block.index({ userId: 1, channelId: 1 }, { unique: true });

export const Playlist = model("Playlist", playlist);
export const PlaylistItem = model("PlaylistItem", item);
export const Caption = model("Caption", caption);
export const Report = model("Report", report);
export const CreatorBlock = model("CreatorBlock", block);
