import { Router } from "express";
import mongoose from "mongoose";
import { Playlist, PlaylistItem, Caption, Report, CreatorBlock } from "../models/features.js";
import CreatorViews from "../../shared/models/creatorViews.model.js";
import Channel from "../../shared/models/channel.model.js";
import ChannelInteraction from "../../shared/models/channelInteraction.model.js";
import Video from "../../shared/models/video.model.js";
import Comment from "../../shared/models/comments.model.js";
import { requireGatewayIdentity as auth } from "../middlewares/requireGatewayIdentity.js";
import { optionalGatewayIdentity as optional } from "../middlewares/optionalGatewayIdentity.js";
import handler from "../middlewares/tryCatch.js";
import { blockedChannelIds, findPlayableVideo } from "../utils/videoAccess.js";
import { withEventTransaction } from "../utils/outbox.js";
import { invalidateVideoCaches } from "../controllers/video.controllers.js";
import { enhancementStages, retryEnhancement } from "../utils/publishing.js";

const FEATURE_PAGE_SIZE = 30;
const validId = mongoose.isObjectIdOrHexString;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const objectId = (value) => {
  if (!validId(value)) fail(400, "Invalid identifier.");
  return value;
};
const nameFrom = (value) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100) fail(400, "Enter a name between 1 and 100 characters.");
  return value.trim();
};

const cursorFilter = (cursor) => cursor ? { _id: { $lt: objectId(cursor) } } : {};
const page = async (model, filter, cursor, select) => {
  const rows = await model.find({ ...filter, ...cursorFilter(cursor) })
    .select(select).sort({ _id: -1 }).limit(FEATURE_PAGE_SIZE + 1).lean();
  const items = rows.slice(0, FEATURE_PAGE_SIZE);
  return { items, next: rows.length > FEATURE_PAGE_SIZE ? String(items.at(-1)._id) : null };
};
const ownChannel = (req) => Channel.findOne({ ownerId: req.auth.userId });
const playlistFilter = (req) => ({ _id: objectId(req.params.id), ownerId: req.auth.userId });
const ownPlaylist = async (req) => {
  const playlist = await Playlist.findOne(playlistFilter(req)).lean();
  if (!playlist) fail(404, "Playlist not found.");
  return playlist;
};

export const playlists = Router();
playlists.use(auth);
playlists.get("/", handler(async (req, res) => {
  res.json(await page(Playlist, { ownerId: req.auth.userId }, req.query.cursor));
}));
playlists.post("/", handler(async (req, res) => {
  const playlist = await Playlist.create({ ownerId: req.auth.userId, name: nameFrom(req.body?.name) });
  res.status(201).json({ playlist });
}));
playlists.patch("/:id", handler(async (req, res) => {
  const playlist = await Playlist.findOneAndUpdate(playlistFilter(req), { name: nameFrom(req.body?.name) }, { new: true });
  if (!playlist) fail(404, "Playlist not found.");
  res.json({ playlist });
}));
playlists.delete("/:id", handler(async (req, res) => {
  await withEventTransaction(async (session) => {
    const result = await Playlist.deleteOne(playlistFilter(req), { session });
    if (!result.deletedCount) fail(404, "Playlist not found.");
    await PlaylistItem.deleteMany({ playlistId: req.params.id }, { session });
  });
  res.sendStatus(204);
}));
playlists.get("/:id", handler(async (req, res) => {
  const playlist = await ownPlaylist(req);
  const result = await page(PlaylistItem, { playlistId: playlist._id }, req.query.cursor);
  const titles = await Video.find({ _id: { $in: result.items.map((item) => item.videoId) } })
    .select("title thumbnailUrl channelId visibility status").lean();
  const byId = new Map(titles.map((video) => [String(video._id), video]));
  const [blocked, channel] = await Promise.all([blockedChannelIds(req.auth.userId), ownChannel(req)]);
  const items = result.items.map((item) => {
    const video = byId.get(String(item.videoId));
    const visible = video && ["ready", "published"].includes(video.status) &&
      !blocked.has(String(video.channelId)) &&
      (video.visibility !== "private" || String(channel?._id) === String(video.channelId));
    return { ...item, video: visible ? video : null };
  });
  res.json({ playlist, items, next: result.next });
}));
playlists.put("/:id/videos/:videoId", handler(async (req, res) => {
  const filter = playlistFilter(req);
  const video = await findPlayableVideo(req.params.videoId, req.auth.userId);
  if (!video) fail(404, "Video not found.");
  await withEventTransaction(async (session) => {
    const result = await Playlist.updateOne(filter, { $currentDate: { updatedAt: true } }, { session, timestamps: false });
    if (!result.matchedCount) fail(404, "Playlist not found.");
    await PlaylistItem.updateOne({ playlistId: filter._id, videoId: video._id }, { $setOnInsert: { videoId: video._id } }, { session, upsert: true });
  });
  res.sendStatus(204);
}));
playlists.delete("/:id/videos/:videoId", handler(async (req, res) => {
  const playlist = await ownPlaylist(req);
  await PlaylistItem.deleteOne({ playlistId: playlist._id, videoId: objectId(req.params.videoId) });
  res.sendStatus(204);
}));

export const studio = Router();
studio.use(auth);
const studioUploads = (channel, cursor) =>
  page(Video, { channelId: channel._id }, cursor, "title status createdAt views publicId processingError publishing");

studio.patch("/uploads/:id/publishing/:stage", handler(async (req, res) => {
  const id = objectId(req.params.id);
  const { stage } = req.params;
  if (!enhancementStages.includes(stage)) fail(400, "Unknown publishing stage.");
  const channel = await ownChannel(req);
  if (!channel || !await Video.exists({ _id: id, channelId: channel._id })) fail(404, "Video not found.");
  if (!await retryEnhancement(id, channel._id, stage)) fail(409, "This asset is no longer eligible for retry.");
  res.sendStatus(204);
}));

studio.get("/uploads", handler(async (req, res) => {
  const channel = await ownChannel(req);
  if (!channel) fail(404, "Create a channel to use Creator Studio.");
  res.json(await studioUploads(channel, req.query.cursor));
}));

studio.get("/", handler(async (req, res) => {
  const channel = await ownChannel(req);
  if (!channel) fail(404, "Create a channel to use Creator Studio.");
  const start = new Date(new Date().toISOString().slice(0, 10));
  start.setUTCDate(start.getUTCDate() - 29);
  const [uploads, top, daily, subscribers, totals] = await Promise.all([
    studioUploads(channel, req.query.cursor),
    Video.find({ channelId: channel._id, status: { $in: ["ready", "published"] } }).select("title views")
      .sort({ views: -1, _id: -1 }).limit(5).lean(),
    CreatorViews.aggregate([
      { $match: { channelId: channel._id, day: { $gte: start } } },
      { $group: { _id: "$day", views: { $sum: "$views" } } }, { $sort: { _id: 1 } },
    ]),
    ChannelInteraction.countDocuments({ channelId: channel._id, subscribed: true }),
    Video.aggregate([
      { $match: { channelId: channel._id, status: { $in: ["ready", "published"] } } },
      { $lookup: {
        from: "videointeractions", localField: "_id", foreignField: "videoId", as: "reactions",
        pipeline: [{ $match: { liked: true } }, { $count: "likes" }],
      } },
      { $group: { _id: null, views: { $sum: "$views" }, likes: { $sum: { $ifNull: [{ $first: "$reactions.likes" }, 0] } } } },
    ]),
  ]);
  const byDay = new Map(daily.map((row) => [row._id.toISOString().slice(0, 10), row.views]));
  const viewsByDay = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(+start + i * 86_400_000).toISOString().slice(0, 10);
    return { date, views: byDay.get(date) || 0 };
  });
  res.json({ uploads, top, viewsByDay, subscribers, views: totals[0]?.views || 0, likes: totals[0]?.likes || 0 });
}));

export const captions = Router();
const captionLanguage = (input) => {
  try {
    const [language] = Intl.getCanonicalLocales(String(input));
    if (language && language.length <= 35) return language;
  } catch {}
  fail(400, "Enter a language tag such as en or hi.");
};
const canManageCaptions = async (req) => {
  const channel = await ownChannel(req);
  if (!channel || !await Video.exists({ _id: objectId(req.params.id), channelId: channel._id })) {
    fail(404, "Video not found.");
  }
};
captions.get("/:id", optional, handler(async (req, res) => {
  if (!await findPlayableVideo(req.params.id, req.auth?.userId)) fail(404, "Video not found.");
  res.set("Cache-Control", "private, no-store").json({
    captions: await Caption.find({ videoId: req.params.id }).select("language label -_id").sort({ language: 1 }).limit(12).lean(),
  });
}));
captions.get("/:id/:language", optional, handler(async (req, res) => {
  if (!await findPlayableVideo(req.params.id, req.auth?.userId)) fail(404, "Video not found.");
  const track = await Caption.findOne({ videoId: req.params.id, language: captionLanguage(req.params.language) }).select("text -_id").lean();
  if (!track) fail(404, "Captions not found.");
  res.set("Cache-Control", "private, no-store").type("text/vtt").send(track.text);
}));
captions.put("/:id/:language", auth, handler(async (req, res) => {
  await canManageCaptions(req);
  const language = captionLanguage(req.params.language);
  const label = nameFrom(req.body?.label);
  const text = typeof req.body?.text === "string" ? req.body.text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n") : "";
  if (Buffer.byteLength(text) > 128 * 1024 || !/^WEBVTT(?:[ \t][^\n]*)?\n\n/.test(text) || !text.includes("-->")) {
    fail(400, "Upload a WebVTT file up to 128 KB containing at least one cue.");
  }
  const filter = { videoId: req.params.id, language };
  await withEventTransaction(async (session) => {
    const video = await Video.updateOne({ _id: req.params.id }, { $currentDate: { updatedAt: true } }, { session, timestamps: false });
    if (!video.matchedCount) fail(404, "Video not found.");
    if (!await Caption.exists(filter).session(session) && await Caption.countDocuments({ videoId: req.params.id }).session(session) >= 12) {
      fail(409, "A video can have up to 12 caption languages.");
    }
    await Caption.updateOne(filter, { $set: { label, text } }, { upsert: true, session });
  });
  res.sendStatus(204);
}));
captions.delete("/:id/:language", auth, handler(async (req, res) => {
  await canManageCaptions(req);
  await Caption.deleteOne({ videoId: req.params.id, language: captionLanguage(req.params.language) });
  res.sendStatus(204);
}));

const isAdmin = (userId) => (process.env.MODERATOR_USER_IDS || "").split(",").some((value) => value.trim() === userId);
const requireAdmin = (req, res, next) => isAdmin(req.auth.userId) ? next() : res.status(403).json({ message: "Moderator access required." });
export const moderation = Router();
moderation.use(auth);
moderation.get("/access", (req, res) => res.json({ moderator: isAdmin(req.auth.userId) }));
moderation.get("/blocks", handler(async (req, res) => {
  const result = await page(CreatorBlock, { userId: req.auth.userId }, req.query.cursor);
  const channels = await Channel.find({ _id: { $in: result.items.map((block) => block.channelId) } }).select("name").lean();
  const names = new Map(channels.map((channel) => [String(channel._id), channel.name]));
  res.json({ ...result, items: result.items.map((block) => ({ ...block, name: names.get(String(block.channelId)) || "Unavailable channel" })) });
}));
moderation.put("/blocks/:id", handler(async (req, res) => {
  const channel = await Channel.findById(objectId(req.params.id)).select("ownerId");
  if (!channel) fail(404, "Channel not found.");
  if (String(channel.ownerId) === req.auth.userId) fail(400, "You cannot block your own channel.");
  try {
    await CreatorBlock.updateOne({ userId: req.auth.userId, channelId: channel._id }, { $setOnInsert: { channelId: channel._id } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  res.sendStatus(204);
}));
moderation.delete("/blocks/:id", handler(async (req, res) => {
  await CreatorBlock.deleteOne({ userId: req.auth.userId, channelId: objectId(req.params.id) });
  res.sendStatus(204);
}));
moderation.post("/reports", handler(async (req, res) => {
  const { kind, targetId, reason } = req.body ?? {};
  if (!["video", "comment"].includes(kind) || !["spam", "harassment", "inappropriate", "other"].includes(reason)) fail(400, "Choose a valid report reason.");
  objectId(targetId);
  const comment = kind === "comment" ? await Comment.findOne({ _id: targetId, deletedAt: null }) : null;
  const video = await findPlayableVideo(kind === "comment" ? comment?.videoId : targetId, req.auth.userId);
  if (!video) fail(404, "Content not found.");
  try {
    await Report.updateOne({ reporterId: req.auth.userId, kind, targetId }, { $setOnInsert: { reason, videoId: video._id } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  res.sendStatus(204);
}));
moderation.get("/reports", requireAdmin, handler(async (req, res) => {
  const result = await page(Report, { state: "open" }, req.query.cursor);
  const videos = await Video.find({ _id: { $in: result.items.map((report) => report.videoId) } }).select("title").lean();
  const comments = await Comment.find({ _id: { $in: result.items.filter((report) => report.kind === "comment").map((report) => report.targetId) } }).select("body").lean();
  const titles = new Map(videos.map((video) => [String(video._id), video.title]));
  const bodies = new Map(comments.map((comment) => [String(comment._id), comment.body]));
  res.json({ ...result, items: result.items.map((report) => ({
    ...report, title: titles.get(String(report.videoId)), body: bodies.get(String(report.targetId)),
  })) });
}));
moderation.patch("/reports/:id", requireAdmin, handler(async (req, res) => {
  const state = req.body?.state;
  if (!["dismissed", "removed"].includes(state)) fail(400, "Choose a review action.");
  const id = objectId(req.params.id);
  const video = await withEventTransaction(async (session) => {
    const report = await Report.findOneAndUpdate({ _id: id, state: "open" }, {
      $set: { state, reviewerId: req.auth.userId, reviewedAt: new Date() },
    }, { session, new: true });
    if (!report) fail(409, "This report was already reviewed or no longer exists.");
    if (state !== "removed") return null;
    if (report.kind === "comment") {
      await Comment.updateOne({ _id: report.targetId, videoId: report.videoId }, { $set: { deletedAt: new Date() } }, { session });
      return null;
    }
    return Video.findByIdAndUpdate(report.targetId, { $set: { status: "moderated" }, $unset: { processingAt: "", processingClaim: "", processingAsset: "" } }, { session, new: true });
  });
  if (video) await invalidateVideoCaches(video, { search: true });
  res.sendStatus(204);
}));
