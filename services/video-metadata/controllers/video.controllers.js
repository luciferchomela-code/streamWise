import asyncHandler from "../middlewares/tryCatch.js";
import Video from "../../shared/models/video.model.js";
import Channel from "../../shared/models/channel.model.js";
import Comment from "../../shared/models/comments.model.js";
import { publishEvent } from "../../shared/config/rabbitmq.js";
import {
  getCacheNamespaceVersion,
  getOrSetJsonCache,
  invalidateCacheNamespace,
} from "../utils/redisCache.js";

const GLOBAL_VIDEO_FEED_CACHE = "global-video-feeds";
const TRENDING_CACHE_TTL_SECONDS = 30;
const POPULAR_CACHE_TTL_SECONDS = 120;

const getCachedGlobalVideoFeed = async ({ feed, page, limit, ttlSeconds, loader }) => {
  const version = await getCacheNamespaceVersion(GLOBAL_VIDEO_FEED_CACHE);
  const key = `streamwise:video-feed:v${version}:${feed}:page:${page}:limit:${limit}`;
  return getOrSetJsonCache({ key, ttlSeconds, loader });
};

export const createDraft = asyncHandler(async (req, res) => {
  const { title, description, visibility, category, thumbnailUrl } = req.body;

  if (!thumbnailUrl) {
    return res.status(400).json({ message: "Thumbnail URL is required." });
  }

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
/**
 * Called by the frontend AFTER Cloudinary confirms the video upload.
 * Saves videoUrl, duration, publicId and marks status as "ready".
 */
export const finalizeVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { videoUrl, duration, publicId } = req.body;

  if (!videoUrl || !publicId) {
    return res.status(400).json({ message: "videoUrl and publicId are required." });
  }

  const channel = await Channel.findOne({ ownerId: req.auth.userId });
  if (!channel) {
    return res.status(404).json({ message: "Channel not found." });
  }

  const video = await Video.findById(videoId);
  if (!video) {
    return res.status(404).json({ message: "Video not found." });
  }

  if (video.channelId.toString() !== channel._id.toString()) {
    return res.status(403).json({ message: "Forbidden: you do not own this video." });
  }

  video.videoUrl = videoUrl;
  video.publicId = publicId;
  video.duration = duration ? Math.round(duration) : null;
  video.status = "ready";
  await video.save();
  await invalidateCacheNamespace(GLOBAL_VIDEO_FEED_CACHE);

  void publishEvent("video.finalized", {
    videoId: video._id.toString(),
    channelId: video.channelId.toString(),
    ownerId: channel.ownerId.toString(),
    title: video.title,
    visibility: video.visibility,
    publicId: video.publicId,
    duration: video.duration,
    status: "ready",
  });

  res.status(200).json({ success: true, video });
});

export const channelVideos = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const channel = await Channel.findById(channelId);
  if (!channel) {
    return res.status(404).json({ message: "Channel not found." });
  }

  const queryFilter = {
    channelId: channel._id,
  };

  const [videos, totalVideos] = await Promise.all([
    Video.find(queryFilter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Video.countDocuments(queryFilter),
  ]);

  res.status(200).json({
    success: true,
    page,
    totalPages: Math.ceil(totalVideos / limit),
    videos,
  });
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

  // Step 1: Delete from Cloudinary (video resource type)
  if (video.publicId) {
    const uploadServiceUrl = process.env.UPLOAD_SERVICE_URL || 'http://localhost:5003';
    try {
      const cloudRes = await fetch(
        `${uploadServiceUrl}/api/upload/video?publicId=${encodeURIComponent(video.publicId)}`,
        { method: 'DELETE' }
      );
      if (!cloudRes.ok) {
        const body = await cloudRes.json().catch(() => ({}));
        // If the asset simply didn't exist on Cloudinary, that's fine — continue
        if (body.result !== 'not found') {
          return res.status(502).json({
            message: `Cloudinary deletion failed: ${body.message || cloudRes.statusText}`,
          });
        }
      }
    } catch (fetchErr) {
      return res.status(502).json({ message: `Could not reach upload service: ${fetchErr.message}` });
    }
  }

  // Step 2: Delete all comments belonging to this video (prevent orphans)
  await Comment.deleteMany({ videoId: video._id });

  // Step 3: Delete the video document
  await video.deleteOne();
  await invalidateCacheNamespace(GLOBAL_VIDEO_FEED_CACHE);

  res.status(200).json({
    success: true,
    message: "Video deleted successfully",
  });
});

export const trendingVideos = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
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
  res.status(200).json(value);
});

export const mostPopularVideos = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
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
  res.status(200).json(value);
});

export const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.auth ? req.auth.userId : null;

  const video = await Video.findById(videoId).populate("channelId");
  if (!video) {
    return res.status(404).json({ message: "Video not found." });
  }

  const isRestricted = video.status === "draft" || video.visibility === "private";

  if (isRestricted) {
    if (!userId) {
      return res.status(401).json({ message: "Authentication required for private/draft videos." });
    }

    // Safely check if the authenticated user is the channel owner
    const isOwner = video.channelId && video.channelId.ownerId.toString() === userId;
    if (!isOwner) {
      return res.status(403).json({ message: "Access restricted to channel owner." });
    }
  }

  res.status(200).json({
    success: true,
    video,
  });
});
export const searchVideos = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  if (!q) {
    return res.status(400).json({ message: "Query is required." });
  }

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

  res.status(200).json({
    success: true,
    page,
    totalPages: Math.ceil(totalVideos / limit),
    videos,
  });
});