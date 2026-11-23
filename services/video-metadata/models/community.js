import mongoose from "mongoose";
const { Schema } = mongoose;
const party = new Schema({ host: String, videoId: String, position: Number, playing: Boolean, version: Number,
  changed: Number, hostSeen: Number, expires: { type: Date, expires: 0 } });
const notice = new Schema({ recipient: String, eventId: String, message: String, path: String, read: { type: Boolean, default: false } });
notice.index({ recipient: 1, eventId: 1 }, { unique: true });
notice.index({ recipient: 1, _id: -1 });
const live = new Schema({ owner: String, title: String, provider: String, playback: String, asset: String, replay: String,
  status: { type: String, default: "waiting" }, checked: { type: Date, default: Date.now } });
live.index({ status: 1, checked: 1 });
const chat = new Schema({ room: String, author: String, name: String, body: String }, { timestamps: true });
chat.index({ room: 1, _id: -1 });
export const Party = mongoose.model("Party", party);
export const Notice = mongoose.model("Notice", notice);
export const Live = mongoose.model("Live", live);
export const Chat = mongoose.model("LiveChat", chat);
