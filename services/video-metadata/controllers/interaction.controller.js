import PlaybackTelemetry from "../../shared/models/playbackTelemetry.model.js";
import { mergePlayed } from "../utils/playedRanges.js";
import GuestView from "../../shared/models/guestView.model.js";
import { verifyGatewaySignature } from "../../shared/utils/gatewaySignature.js";
import { deleteCache } from "../utils/redisCache.js";
import { getReactionCounts, withReactionCounts } from "../utils/reactionCounts.js";
import asyncHandler from "../middlewares/tryCatch.js";
import Video from "../../shared/models/video.model.js";
import VideoInteraction from "../../shared/models/videoInteraction.model.js";
import Comment from "../../shared/models/comments.model.js";
import Channel from "../../shared/models/channel.model.js";
import User from "../../shared/models/user.model.js";
import { recordEvent, withEventTransaction } from "../utils/outbox.js";
import CreatorViews from "../../shared/models/creatorViews.model.js";
import { createHash } from "node:crypto";
import { findPlayableVideo, blockedChannelIds } from "../utils/videoAccess.js";


const toggleReaction = (reaction, opposite, label) => asyncHandler(async (req, res) => {
  const { userId } = req.auth;
  const video = await findPlayableVideo(req.params.videoId, userId);
  if (!video) return res.status(404).json({ message: "Video not found." });

  const { interaction, counts, active } = await withEventTransaction(async (session) => {
    const interaction = await VideoInteraction.findOneAndUpdate(
      { userId, videoId: video._id },
      [{ $set: {
        [reaction]: { $not: [{ $ifNull: [`$${reaction}`, false] }] },
        [opposite]: false,
        reactionAt: "$$NOW",
      } }],
      { new: true, upsert: true, updatePipeline: true, session },
    );
    const counts = await getReactionCounts(video._id, session);
    const active = interaction[reaction];
    await recordEvent(session, `video.${reaction}`, {
      videoId: video.id, userId, [reaction]: active, ...counts, interactionId: interaction.id,
    });
    return { interaction, counts, active };
  });

  res.json({
    success: true,
    message: active ? `Video ${reaction} successfully` : `${label} removed successfully`,
    ...counts,
    interaction,
  });
});

export const toggleLike = toggleReaction("liked", "disliked", "Like");
export const toggleDislike = toggleReaction("disliked", "liked", "Dislike");

const VIEW_WINDOW_MS = 60 * 60 * 1000;
const GUEST_VIEW_WINDOW_MS = 10 * 60 * 1000;

const claimGuestView = async (req, videoId, now, session) => {
  const viewer = req.get("x-guest-viewer");
  if (!viewer || !/^[a-f0-9]{64}$/.test(viewer) || !verifyGatewaySignature({
    userId: `guest:${viewer}`,
    requestId: req.get("x-request-id"),
    timestamp: req.get("x-gateway-timestamp"),
    signature: req.get("x-guest-viewer-signature"),
  })) return false;

  const previous = await GuestView.findOneAndUpdate(
    { _id: `${videoId}:${viewer}` },
    [{ $set: { expiresAt: {
      $cond: [
        { $lte: [{ $ifNull: ["$expiresAt", new Date(0)] }, now] },
        new Date(+now + GUEST_VIEW_WINDOW_MS), "$expiresAt",
      ],
    } } }],
    { new: false, upsert: true, updatePipeline: true, session },
  );
  return !previous || previous.expiresAt <= now;
};

export const savePlayback = asyncHandler(async (req, res) => {
  const { ranges, position, duration: reportedDuration, rangesOnly, feedId, feedPosition } = req.body || {};
  if (!Array.isArray(ranges) || ranges.length === 0 || ranges.length > 128 ||
      !Number.isFinite(position) || position < 0 ||
      !Number.isFinite(reportedDuration) || reportedDuration <= 0 ||
      !ranges.every(pair => Array.isArray(pair) && pair.length === 2 &&
        pair.every(Number.isFinite) && pair[0] >= 0 && pair[1] > pair[0])) {
    return res.status(400).json({ message: "Invalid playback ranges" });
  }
  const video = await findPlayableVideo(req.params.videoId, req.auth.userId);
  if (!video) return res.sendStatus(404);
  const duration = video.duration || reportedDuration;
  const key = { userId: req.auth.userId, videoId: video._id };
  // The revision check preserves disjoint ranges reported concurrently by two tabs.
  for (let attempt = 0; attempt < 5; attempt++) {
    const previous = await VideoInteraction.findOne(key).select("+playedRanges").lean();
    const { ranges: merged, seconds } = mergePlayed(previous?.playedRanges || [], ranges, duration);
    if (!seconds) return res.sendStatus(204);
    const revision = previous?.playbackRevision;
    const query = { ...key, playbackRevision: revision ?? { $exists: false } };
    const progress = {
      playedRanges: merged, playedSeconds: seconds, playedDuration: duration,
    };
    if (seconds > (previous?.playedSeconds || 0)) progress.playedAt = new Date();
    if (/^[a-f0-9]{24}$/i.test(String(feedId ?? ''))) {
      progress.attributionFeedId = feedId;
      progress.attributionPosition = Number.isInteger(feedPosition) && feedPosition >= 0 ? feedPosition : null;
    }
    const update = { $set: progress, $inc: { playbackRevision: 1 } };
    if (rangesOnly !== true) {
      progress.lastWatchedPosition = Math.min(position, duration);
      update.$max = { watchPercentage: Math.min(100, 100 * seconds / duration) };
    }
    try {
      const result = await VideoInteraction.updateOne(query, update, { upsert: !previous });
      if (result.matchedCount || result.upsertedCount) return res.sendStatus(204);
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  return res.status(409).json({ message: "Retry playback update" });
});

export const incViewCount = asyncHandler(async (req, res) => {
  const userId = req.auth?.userId ?? null;
  const { watchPercentage, lastWatchedPosition, observedAt } = req.body ?? {};
  const now = new Date();
  const observedTime = observedAt === undefined ? now.getTime() : observedAt;
  if (!Number.isFinite(watchPercentage) || watchPercentage <= 0 || watchPercentage > 100 ||
      !Number.isFinite(lastWatchedPosition) || lastWatchedPosition < 0 ||
      !Number.isFinite(observedTime) || observedTime < now.getTime() - 86_400_000 ||
      observedTime > now.getTime() + 60_000) {
    return res.status(400).json({ message: "Invalid watch progress." });
  }

  const video = await findPlayableVideo(req.params.videoId, userId);
  if (!video) return res.status(404).json({ message: "Video not found." });

  const { views, shouldCount } = await withEventTransaction(async (session) => {
    let shouldCount;
    let progressChanged = false;
    if (userId) {
      const observed = new Date(observedTime);
      const cutoff = new Date(now.getTime() - VIEW_WINDOW_MS);
      const newer = { $gt: [observed, { $ifNull: ["$lastViewedAt", new Date(0)] }] };
      const countView = { $and: [
        newer,
        { $lte: [{ $ifNull: ["$lastCountedAt", { $ifNull: ["$lastViewedAt", new Date(0)] }] }, cutoff] },
      ] };
      const position = video.duration > 0 ? Math.min(lastWatchedPosition, video.duration) : lastWatchedPosition;
      const previous = await VideoInteraction.findOneAndUpdate({ userId, videoId: video._id }, [
        { $set: {
          viewCount: { $add: [{ $ifNull: ["$viewCount", 0] }, { $cond: [countView, 1, 0] }] },
          lastCountedAt: { $cond: [countView, now, { $ifNull: ["$lastCountedAt", "$lastViewedAt"] }] },
          lastViewedAt: { $cond: [newer, observed, "$lastViewedAt"] },
          lastWatchedPosition: { $cond: [newer, position, "$lastWatchedPosition"] },
          watchPercentage: { $cond: [newer, { $max: [{ $ifNull: ["$watchPercentage", 0] }, watchPercentage] }, "$watchPercentage"] },
        } },
      ], { new: false, updatePipeline: true, timestamps: false, upsert: true, session });
      progressChanged = !previous?.lastViewedAt || observed > previous.lastViewedAt;
      const lastCounted = previous?.lastCountedAt ?? previous?.lastViewedAt;
      shouldCount = progressChanged && (!lastCounted || lastCounted <= cutoff);
    } else {
      shouldCount = await claimGuestView(req, video.id, now, session);
    }

    let views = video.views;
    if (shouldCount) {
      const updatedVideo = await Video.findByIdAndUpdate(video._id, { $inc: { views: 1 } }, { new: true, session });
      if (!updatedVideo) throw Object.assign(new Error("Video not found."), { status: 404 });
      views = updatedVideo.views;
      const day = new Date(now.toISOString().slice(0, 10));
      const fingerprint = userId || req.get("x-guest-viewer");
      const bucket = createHash("sha256").update(fingerprint).digest()[0] % 16;
      await CreatorViews.updateOne(
        { _id: `${video.channelId}:${day.toISOString()}:${bucket}` },
        { $setOnInsert: { channelId: video.channelId, day, bucket }, $inc: { views: 1 } },
        { session, upsert: true },
      );
    }
    if (shouldCount || progressChanged) {
      await recordEvent(session, "video.viewed", {
        videoId: video.id, userId, watchPercentage, lastWatchedPosition, views,
      });
    }
    return { views, shouldCount };
  });
  if (shouldCount) await deleteCache(`streamwise:video:${video.id}`);
  res.json({ success: true, views });
});

export const getComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const video = await findPlayableVideo(videoId, req.auth?.userId);
  if (!video) return res.status(404).json({ message: "Video not found." });
  const comments = await Comment.find({ videoId, deletedAt: null })
    .populate("authorId", "name image")
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, comments });
});

export const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.auth.userId;
  const { commentText, parentCommentId = null } = req.body;

  if (!commentText || !commentText.trim()) {
    return res.status(400).json({ message: "Comment body is required." });
  }

  if (commentText.trim().length > 2000) {
    return res.status(400).json({ message: "Comment must not exceed 2000 characters." });
  }

  // Verify the video exists before attaching a comment to it
  const video = await findPlayableVideo(videoId, userId);
  if (!video) {
    return res.status(404).json({ message: "Video not found." });
  }

  const comment = await withEventTransaction(async session => {
    const [item] = await Comment.create([{
    videoId,
    authorId: userId,
    body: commentText.trim(),
    parentCommentId,
    }], {session});
    await recordEvent(session,"video.commented",{videoId,userId,commentId:item.id});
    return item;
  });

  const populatedComment = await Comment.findById(comment._id).populate("authorId", "name image");

  res.status(201).json({ success: true, comment: populatedComment });
});

export const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.auth.userId;

  const comment = await Comment.findById(commentId);
  if (!comment) {
    return res.status(404).json({ message: "Comment not found." });
  }

  const isAuthor = comment.authorId.toString() === userId;

  // Also allow the video's channel owner to moderate comments
  let isVideoOwner = false;
  if (!isAuthor) {
    const video = await Video.findById(comment.videoId).select('channelId');
    if (video) {
      const channel = await Channel.findById(video.channelId).select('ownerId');
      isVideoOwner = channel && channel.ownerId.toString() === userId;
    }
  }

  if (!isAuthor && !isVideoOwner) {
    return res.status(403).json({ message: "Unauthorized to delete this comment." });
  }

  // Delete replies first, then the comment itself
  await Comment.deleteMany({ parentCommentId: commentId });
  await Comment.findByIdAndDelete(commentId);

  res.status(200).json({
    success: true,
    message: "Comment deleted successfully.",
  });
});

export const toggleWatchLater = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.auth.userId;

  const previousInteraction = await VideoInteraction.findOne({ userId, videoId });
  let newWatchLaterState = true;
  if (previousInteraction && previousInteraction.watchLater) {
    newWatchLaterState = false;
  }

  const interaction = await VideoInteraction.findOneAndUpdate(
    { userId, videoId },
    { $set: { watchLater: newWatchLaterState } },
    { new: true, upsert: true }
  );

  res.status(200).json({
    success: true,
    message: newWatchLaterState ? "Saved to Watch Later" : "Removed from Watch Later",
    watchLater: newWatchLaterState,
    interaction,
  });
});

export const getWatchLater = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const interactions = await VideoInteraction.find({ userId, watchLater: true })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: "videoId",
      populate: { path: "channelId", select: "name image handle subscribersCount" },
    });

  const total = await VideoInteraction.countDocuments({ userId, watchLater: true });

  const blocked = await blockedChannelIds(userId);
  const videos = interactions
    .filter((i) => i.videoId && i.videoId.status !== "moderated" && !blocked.has(String(i.videoId.channelId?._id)))
    .map((i) => i.videoId);

  res.status(200).json({
    success: true,
    page,
    totalPages: Math.ceil(total / limit),
    total,
    videos: await withReactionCounts(videos),
  });
});

export const checkVideoInteractionStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.auth.userId;

  const interaction = await VideoInteraction.findOne({ userId, videoId });
  res.status(200).json({
    success: true,
    watchLater: !!(interaction && interaction.watchLater),
    liked: !!(interaction && interaction.liked),
    disliked: !!(interaction && interaction.disliked),
    lastWatchedPosition: interaction ? interaction.lastWatchedPosition : 0,
  });
});

export const getWatchHistory = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  // Include any interaction where the user actually viewed (lastViewedAt is set)
  const interactions = await VideoInteraction.find({ 
    userId, 
    lastViewedAt: { $ne: null } 
  })
    .sort({ lastViewedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: "videoId",
      populate: { path: "channelId", select: "name image handle subscribersCount" },
    });

  const total = await VideoInteraction.countDocuments({ userId, lastViewedAt: { $ne: null } });

  const blocked = await blockedChannelIds(userId);
  const history = interactions
    .filter((i) => i.videoId && i.videoId.status !== "moderated" && !blocked.has(String(i.videoId.channelId?._id)))
    .map((i) => ({
      ...i.videoId.toObject(),
      lastWatchedPosition: i.lastWatchedPosition,
      watchPercentage: i.watchPercentage,
      lastViewedAt: i.lastViewedAt,
    }));

  res.status(200).json({
    success: true,
    page,
    totalPages: Math.ceil(total / limit),
    total,
    history: await withReactionCounts(history),
  });
});

export const getContinueWatching = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  
  // Any video started (>=1%) but not fully watched (<95%)
  const interactions = await VideoInteraction.find({ 
    userId, 
    lastViewedAt: { $ne: null },
    watchPercentage: { $gte: 1, $lt: 95 } 
  })
    .sort({ lastViewedAt: -1 })
    .limit(10)
    .populate({
      path: "videoId",
      populate: { path: "channelId", select: "name image handle subscribersCount" },
    });

  const blocked = await blockedChannelIds(userId);
  const continueWatching = interactions
    .filter((i) => i.videoId && i.videoId.status !== "moderated" && !blocked.has(String(i.videoId.channelId?._id)))
    .map((i) => ({
      ...i.videoId.toObject(),
      lastWatchedPosition: i.lastWatchedPosition,
      watchPercentage: i.watchPercentage,
    }));

  res.status(200).json({
    success: true,
    continueWatching: await withReactionCounts(continueWatching),
  });
});

export const saveTelemetry = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const {
    ttffMs,
    totalStallMs,
    totalWatchDurationMs,
    rebufferRatio,
    startFailed,
    browser,
    resolution,
    networkType,
  } = req.body || {};

  const userId = req.auth ? req.auth.userId : null;

  await PlaybackTelemetry.create({
    videoId,
    userId,
    ttffMs: Number(ttffMs) || 0,
    totalStallMs: Number(totalStallMs) || 0,
    totalWatchDurationMs: Number(totalWatchDurationMs) || 0,
    rebufferRatio: Number(rebufferRatio) || 0,
    startFailed: Boolean(startFailed),
    browser: String(browser || "unknown").slice(0, 64),
    resolution: String(resolution || "auto").slice(0, 32),
    networkType: String(networkType || "unknown").slice(0, 32),
  });

  res.status(204).end();
});
