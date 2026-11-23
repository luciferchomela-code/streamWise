import { randomUUID } from "node:crypto";
import { createGatewaySignature } from "../../shared/utils/gatewaySignature.js";
import asyncHandler from "../middlewares/tryCatch.js";
import Video from "../../shared/models/video.model.js";
import Channel from "../../shared/models/channel.model.js";
import Comment from "../../shared/models/comments.model.js";
import { recordEvent, withEventTransaction } from "../utils/outbox.js";
import { enhancementStages, processEnhancement, queueEnhancements, verifyManifest } from "../utils/publishing.js";
import { UploadProcessingRun } from "../models/playbackHealth.js";
import { blockedChannelIds, isBlocked } from "../utils/videoAccess.js";
import { getReactionCounts, withReactionCounts } from "../utils/reactionCounts.js";
import {
  getCacheNamespaceVersion,
  getOrSetJsonCache,
  invalidateCacheNamespace,
  deleteCache,
  deleteCacheByPrefix,
} from "../utils/redisCache.js";

const GLOBAL_VIDEO_FEED_CACHE = "global-video-feeds";
// Raised from 30s → 300s. Trending changes slowly; hammering DB every 30s is wasteful.
const TRENDING_CACHE_TTL_SECONDS = 300;
const POPULAR_CACHE_TTL_SECONDS = 120;
const VIDEO_CACHE_TTL_SECONDS = 60;       // individual video pages
const CHANNEL_VIDEOS_CACHE_TTL = 60;      // channel video lists
const SEARCH_CACHE_TTL_SECONDS = 30;      // search results (acceptable short stale window)

// Cache key helpers — centralised so invalidation always matches the read key exactly
const videoKey = (videoId) => `streamwise:video:${videoId}`;
const channelVideosPrefix = (channelId) => `streamwise:channel-videos:${channelId}:`;
const channelVideoKey = (channelId, scope, page, limit) =>
  `${channelVideosPrefix(channelId)}${scope}:page:${page}:limit:${limit}`;
const searchKey = (q, page, limit, version) =>
  `streamwise:search:v${version}:${encodeURIComponent(q)}:page:${page}:limit:${limit}`;

const getCachedGlobalVideoFeed = async ({ feed, page, limit, ttlSeconds, loader }) => {
  const version = await getCacheNamespaceVersion(GLOBAL_VIDEO_FEED_CACHE);
  const key = `streamwise:video-feed:v${version}:${feed}:page:${page}:limit:${limit}`;
  return getOrSetJsonCache({ key, ttlSeconds, loader });
};

export const createDraft = asyncHandler(async (req, res) => {
  const { title, description, visibility, category, thumbnailUrl } = req.body;

  const channel = await Channel.findOne({ ownerId: req.auth.userId });
  if (!channel) {
    return res.status(404).json({ message: "Channel not found for this user." });
  }

  const video = await Video.create({
    channelId: channel._id,
    title,
    description,
    thumbnailUrl,
    category: category || "General",
    status: "draft",         // starts as draft — not visible until finalized
    visibility: visibility || "public",
  });

  res.status(201).json({
    success: true,
    video,
  });
});

// ─── PATCH /api/videos/:videoId/finalize ─────────────────────────────────────
const isVideoAssetId = (videoId, publicId) =>
  [`streamwise/videos/${videoId}`, `streamwise/videos/streamwise/videos/${videoId}`].includes(publicId);

const requestUploadService = (userId, path, method = "GET", requestId = randomUUID()) => {
  const baseUrl = process.env.UPLOAD_SERVICE_INTERNAL_URL ||
    process.env.UPLOAD_SERVICE_URL || "http://localhost:5003";
  const timestamp = Date.now();
  return fetch(`${baseUrl}/api/upload/${path}`, {
    method,
    signal: AbortSignal.timeout(8000),
    headers: {
      "x-user-id": userId,
      "x-request-id": requestId,
      "x-gateway-timestamp": String(timestamp),
      "x-gateway-signature": createGatewaySignature({ userId, requestId, timestamp }),
    },
  });
};

export const invalidateVideoCaches = async (video, { search = false } = {}) => {
  await Promise.all([
    invalidateCacheNamespace(GLOBAL_VIDEO_FEED_CACHE),
    deleteCache(videoKey(String(video._id))),
    deleteCacheByPrefix(channelVideosPrefix(String(video.channelId))),
    ...(search ? [invalidateCacheNamespace("video-search")] : []),
  ]);
};

export const finalizeVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { publicId } = req.body ?? {};
  const { userId } = req.auth;
  if (!/^[a-f0-9]{24}$/.test(videoId) || !isVideoAssetId(videoId, publicId)) {
    return res.status(400).json({ message: "Invalid asset for this video." });
  }

  const channel = await Channel.findOne({ ownerId: userId });
  if (!channel) return res.status(404).json({ message: "Channel not found." });
  const draft = await Video.findOne({ _id: videoId, channelId: channel._id });
  if (!draft) return res.status(404).json({ message: "Video not found." });
  if (["ready", "processing"].includes(draft.status) && draft.publicId === publicId) {
    return res.status(draft.status === "ready" ? 200 : 202).json({ success: true, video: draft });
  }
  if (!["draft", "uploading", "failed"].includes(draft.status) || (draft.publicId && draft.publicId !== publicId)) {
    return res.status(409).json({ message: "This upload cannot be finalized." });
  }

  const queuedAt = new Date();
  const requestId = req.get("x-request-id") || randomUUID();
  const queued = await Video.findOneAndUpdate(
    { _id: videoId, channelId: channel._id, status: draft.status },
    { $set: { status: "processing", publicId, processingAt: queuedAt, processingAttempts: 0,
      processingQueuedAt: queuedAt, processingRequestId: requestId },
      $unset: { processingClaim: "", processingError: "", processingAsset: "" } },
    { new: true, runValidators: true },
  );
  if (!queued) return res.status(409).json({ message: "Upload changed. Reload its status." });
  logProcessing(queued, requestId, "upload.queued");
  await invalidateVideoCaches(queued);
  res.status(202).json({ success: true, video: queued });
});

const logProcessing = (video, requestId, event, durationMs) => console.info(JSON.stringify({
  service: event === "upload.queued" ? "video-metadata" : "video-worker",
  event, requestId, videoId: video.id, durationMs,
}));

const processNextVideo = async () => {
  const now = new Date();
  const claim = randomUUID();
  const video = await Video.findOneAndUpdate(
    { status: "processing", processingAt: { $lte: now } },
    { $set: { processingAt: new Date(+now + 60_000), processingClaim: claim }, $inc: { processingAttempts: 1 } },
    { sort: { processingAt: 1, _id: 1 }, new: true },
  ).select("+processingAsset +processingQueuedAt +processingRequestId");
  if (!video) return false;
  const filter = { _id: video._id, status: "processing", processingClaim: claim };
  const requestId = video.processingRequestId || randomUUID();
  const channel = await Channel.findById(video.channelId).select("ownerId");
  let asset = video.processingAsset;
  let reason = "Cloudinary is still processing the video.";
  if (channel && !asset?.baselineUrl) {
    try {
      const query = new URLSearchParams({ videoId: video.id, publicId: video.publicId });
      const response = await requestUploadService(String(channel.ownerId), `video/internal?${query}`, "GET", requestId);
      if (response.ok) asset = await response.json();
      if (response.status === 404 || response.status === 422) reason = "Cloudinary could not find a playable upload.";
    } catch (error) {
      console.warn("[processing]", requestId, error.message);
    }
  } else if (!channel) {
    reason = "The channel no longer exists.";
  }

  const validAsset = asset?.publicId === video.publicId && asset.videoUrl && asset.baselineUrl && asset.hlsUrl &&
    Number.isFinite(asset.duration);
  const streamAvailable = validAsset && await verifyManifest(asset.baselineUrl);
  const finishedAt = new Date();
  const durationMs = Math.max(0, +finishedAt - (video.processingQueuedAt?.getTime() ?? now.getTime()));
  if (channel && streamAvailable) {
    const ready = await withEventTransaction(async (session) => {
      const updated = await Video.findOneAndUpdate(filter, { $set: {
        status: "ready", videoUrl: asset.videoUrl, hlsUrl: asset.baselineUrl, duration: Math.round(asset.duration),
        publishing: queueEnhancements(video), processingAsset: asset, processingRequestId: requestId,
      }, $unset: { processingAt: "", processingClaim: "", processingError: "" } }, { session, new: true });
      if (updated) {
        await recordEvent(session, "video.finalized", {
          videoId: updated.id, channelId: String(updated.channelId), ownerId: String(channel.ownerId),
          title: updated.title, visibility: updated.visibility, publicId: updated.publicId,
          duration: updated.duration, status: "ready", requestId,
        });
        await UploadProcessingRun.create([{ _id: requestId, finishedAt, durationMs, failed: false }], { session });
      }
      return updated;
    });
    if (ready) {
      logProcessing(ready, requestId, "upload.ready", durationMs);
      await invalidateVideoCaches(ready, { search: true });
    }
  } else if (!channel || video.processingAttempts >= 24) {
    const failed = await withEventTransaction(async (session) => {
      const updated = await Video.findOneAndUpdate(filter, { $set: { status: "failed", processingError: reason },
        $unset: { processingAt: "", processingClaim: "" } }, { session, new: true });
      if (updated) await UploadProcessingRun.create([{ _id: requestId, finishedAt, durationMs, failed: true }], { session });
      return updated;
    });
    if (failed) {
      logProcessing(failed, requestId, "upload.failed", durationMs);
      await invalidateVideoCaches(failed);
    }
  } else {
    const delay = Math.min(60_000, 4000 * 2 ** Math.min(video.processingAttempts - 1, 4));
    await Video.updateOne(filter, { $set: {
      processingAt: new Date(Date.now() + delay), ...(validAsset ? { processingAsset: asset } : {}),
    }, $unset: { processingClaim: "" } });
  }
  return true;
};

export const startProcessing = () => {
  const poll = async () => {
    try {
      await processNextVideo();
    } catch (error) {
      console.error("[processing]", error.message);
    } finally {
      setTimeout(poll, 2000);
    }
  };
  void poll();
  for (const stage of enhancementStages) {
    const pollEnhancement = async () => {
      try {
        await processEnhancement(stage, invalidateVideoCaches);
      } catch (error) {
        console.error("[publishing]", stage, error.message);
      } finally {
        setTimeout(pollEnhancement, 3000);
      }
    };
    void pollEnhancement();
  }
};

const visibleResults = async (req, videos) => {
  const blocked = await blockedChannelIds(req.auth?.userId);
  return withReactionCounts(videos.filter((video) => !blocked.has(String(video.channelId?._id ?? video.channelId))));
};

export const channelVideos = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const channel = await Channel.findById(channelId);
  if (!channel || await isBlocked(req.auth?.userId, channelId)) {
    return res.status(404).json({ message: "Channel not found." });
  }

  const isOwner = channel.ownerId.toString() === req.auth?.userId;
  if (isOwner) res.set("Cache-Control", "private, no-store");
  // Cache the video list per channel, visibility scope, and page.
  // Dirty read prevention: this key is deleted (via deleteCacheByPrefix) whenever
  // the channel uploads a new video or deletes one, so stale lists never persist.
  const { value, cacheStatus } = await getOrSetJsonCache({
    key: channelVideoKey(channelId, isOwner ? "owner" : "public", page, limit),
    ttlSeconds: CHANNEL_VIDEOS_CACHE_TTL,
    loader: async () => {
      const queryFilter = isOwner
        ? { channelId: channel._id }
        : { channelId: channel._id, status: "ready", visibility: "public" };
      const [videos, totalVideos] = await Promise.all([
        Video.find(queryFilter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Video.countDocuments(queryFilter),
      ]);
      return {
        success: true,
        page,
        totalPages: Math.ceil(totalVideos / limit),
        videos,
      };
    },
  });

  res.set("X-Cache", cacheStatus);
  res.status(200).json({ ...value, videos: await visibleResults(req, value.videos) });
});

export const deleteVideo = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const { videoId } = req.params;

  const channel = await Channel.findOne({ ownerId: userId });
  if (!channel) {
    return res.status(404).json({ message: "Channel not found." });
  }

  const video = await Video.findById(videoId);
  if (!video) {
    return res.status(404).json({ message: "Video not found." });
  }

  if (video.channelId.toString() !== channel._id.toString()) {
    return res.status(403).json({ message: "You are not authorized to delete this video." });
  }

  // Step 1: Delete from Cloudinary via the internal upload service route.
  //
  // Why internal route instead of calling Cloudinary directly?
  //   - Keeps Cloudinary credentials in one place (upload service only).
  //   - The upload service's requireGatewayIdentity middleware verifies the
  //     HMAC signature, so only trusted internal callers can reach this path.
  //
  // We use UPLOAD_SERVICE_INTERNAL_URL (direct Docker/K8s network address)
  // so the request never leaves the internal network, then fall back to the
  // public UPLOAD_SERVICE_URL for local dev.
  //
  // If Cloudinary says "not found" the asset is already gone — safe to continue
  // so the user can retry a partial deletion without getting stuck.
  // If cleanup fails for any other reason, preserve metadata so the user can retry.
  if (video.publicId && isVideoAssetId(video._id.toString(), video.publicId)) {
    try {
      const query = new URLSearchParams({ publicId: video.publicId });
      const cloudRes = await requestUploadService(userId, `video/internal?${query}`, "DELETE");

      if (!cloudRes.ok) {
        const body = await cloudRes.json().catch(() => ({}));
        // "not found" means the Cloudinary asset is already gone — treat as success
        // so deletion can be safely retried without getting stuck on a missing asset.
        if (body.result !== "not found") {
          // Preserve metadata so the user can retry deletion later.
          return res.status(502).json({
            message:
              `Cloudinary deletion failed: ${body.message || cloudRes.statusText}. ` +
              "Video metadata preserved — please retry deletion.",
          });
        }
      }
    } catch (fetchErr) {
      // Network error reaching the upload service. Preserve metadata so the user
      // can retry deletion once the upload service recovers.
      return res.status(502).json({
        message:
          `Could not reach upload service: ${fetchErr.message}. ` +
          "Video metadata preserved — please retry deletion.",
      });
    }
  }

  // Step 2: Delete all comments belonging to this video (prevent orphans)
  await Comment.deleteMany({ videoId: video._id });

  // Step 3: Delete the video document
  await video.deleteOne();

  // Invalidate all affected caches together:
  // - Global feeds (trending / popular) via version bump
  // - This video's individual cache key (write-through, prevents dirty reads)
  // - The channel's paginated video list (all pages) via prefix scan
  await Promise.all([
    invalidateCacheNamespace(GLOBAL_VIDEO_FEED_CACHE),
    deleteCache(videoKey(videoId)),
    deleteCacheByPrefix(channelVideosPrefix(video.channelId.toString())),
  ]);

  res.status(200).json({
    success: true,
    message: "Video deleted successfully",
  });
});

export const trendingVideos = asyncHandler(async (req, res) => {
  const page = Math.min(1000, Math.max(1, parseInt(req.query.page, 10) || 1));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  const { value, cacheStatus } = await getCachedGlobalVideoFeed({
    feed: "trending",
    page,
    limit,
    ttlSeconds: TRENDING_CACHE_TTL_SECONDS,
    loader: async () => {
      // Calculate timestamp for 24 hours ago on cache misses.
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const queryFilter = {
        visibility: "public",
        status: { $in: ["ready", "published"] },
        createdAt: { $gte: twentyFourHoursAgo },
      };

      const [videos, totalVideos] = await Promise.all([
        Video.find(queryFilter).sort({ views: -1 }).skip(skip).limit(limit),
        Video.countDocuments(queryFilter),
      ]);

      return {
        success: true,
        page,
        totalPages: Math.ceil(totalVideos / limit),
        videos,
      };
    },
  });

  res.set("X-Cache", cacheStatus);
  res.status(200).json({ ...value, videos: await visibleResults(req, value.videos) });
});

export const mostPopularVideos = asyncHandler(async (req, res) => {
  const page = Math.min(1000, Math.max(1, parseInt(req.query.page, 10) || 1));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  const { value, cacheStatus } = await getCachedGlobalVideoFeed({
    feed: "popular",
    page,
    limit,
    ttlSeconds: POPULAR_CACHE_TTL_SECONDS,
    loader: async () => {
      // All-time best/most viewed videos.
      const queryFilter = {
        visibility: "public",
        status: { $in: ["ready", "published"] },
      };

      const [videos, totalVideos] = await Promise.all([
        Video.find(queryFilter).sort({ views: -1 }).skip(skip).limit(limit),
        Video.countDocuments(queryFilter),
      ]);

      return {
        success: true,
        page,
        totalPages: Math.ceil(totalVideos / limit),
        videos,
      };
    },
  });

  res.set("X-Cache", cacheStatus);
  res.status(200).json({ ...value, videos: await visibleResults(req, value.videos) });
});

export const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.auth ? req.auth.userId : null;

  // Private/draft videos must never be cached — we'd risk serving restricted content
  // to unauthorized users from cache. Only cache public, ready videos.
  // Cache key: "streamwise:video:VIDEO_ID" — deleted immediately when the video is edited/deleted.
  const { value: video, cacheStatus } = await getOrSetJsonCache({
    key: videoKey(videoId),
    ttlSeconds: VIDEO_CACHE_TTL_SECONDS,
    loader: async () => {
      const v = await Video.findById(videoId).populate("channelId");
      return v ? v.toObject() : null;
    },
  });

  if (!video || video.status === "moderated" ||
      await isBlocked(userId, video.channelId?._id ?? video.channelId) ||
      (cacheStatus === "HIT" && !await Video.exists({ _id: videoId, status: { $ne: "moderated" } }))) {
    return res.status(404).json({ message: "Video not found." });
  }

  const isRestricted = !["ready", "published"].includes(video.status) || video.visibility === "private";

  if (isRestricted) {
    res.set("Cache-Control", "private, no-store");
    // Do NOT serve cached data for restricted videos — bypass cache result
    // and force a fresh DB read to apply proper auth checks.
    if (!userId) {
      return res.status(401).json({ message: "Authentication required for private/draft videos." });
    }
    const isOwner =
      video.channelId && video.channelId.ownerId &&
      video.channelId.ownerId.toString() === userId;
    if (!isOwner) {
      return res.status(403).json({ message: "Access restricted to channel owner." });
    }
  }

  res.set("X-Cache", cacheStatus);
  res.status(200).json({
    success: true,
    video: { ...video, ...await getReactionCounts(video._id) },
  });
});
export const searchVideos = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const page = Math.min(1000, Math.max(1, parseInt(req.query.page, 10) || 1));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  if (!q) {
    return res.status(400).json({ message: "Query is required." });
  }

  // Cache search results by query string + pagination.
  // Strategy: TTL-only (30s). If a new video is uploaded that matches this query,
  // the user may see stale results for up to 30 seconds — acceptable trade-off
  // since MongoDB full-text search ($text) is expensive and search results
  // don't need to be real-time.
  const { value, cacheStatus } = await getOrSetJsonCache({
    key: searchKey(q, page, limit, await getCacheNamespaceVersion("video-search")),
    ttlSeconds: SEARCH_CACHE_TTL_SECONDS,
    loader: async () => {
      const queryFilter = {
        $text: { $search: q },
        visibility: "public",
        status: { $in: ["ready", "published"] },
      };
      const [videos, totalVideos] = await Promise.all([
        Video.find(queryFilter, { score: { $meta: "textScore" } })
          .sort({ score: { $meta: "textScore" } })
          .skip(skip)
          .limit(limit),
        Video.countDocuments(queryFilter),
      ]);
      return {
        success: true,
        page,
        totalPages: Math.ceil(totalVideos / limit),
        videos,
      };
    },
  });

  res.set("X-Cache", cacheStatus);
  res.status(200).json({ ...value, videos: await visibleResults(req, value.videos) });
});
