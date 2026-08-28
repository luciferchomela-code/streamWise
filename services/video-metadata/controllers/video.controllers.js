import asyncHandler from "../middlewares/tryCatch.js";
import Video from "../../shared/models/video.model.js";
import Channel from "../../shared/models/channel.model.js";

export const createDraft = asyncHandler(async (req, res) => {
  const { title, description, visibility, thumbnailUrl } = req.body;

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
    status: "draft",
    visibility: visibility || "public",
  });

  res.status(201).json({
    success: true,
    video,
  });
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
    visibility: "public",
    status: { $in: ["ready", "published"] },
  };

  const videos = await Video.find(queryFilter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalVideos = await Video.countDocuments(queryFilter);

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

  await video.deleteOne();

  // Optional: Emit event to message queue (RabbitMQ) or send a call to file storage service to delete thumbnail/video media.

  res.status(200).json({
    success: true,
    message: "Video deleted successfully",
  });
});

export const trendingVideos = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const queryFilter = {
    visibility: "public",
    status: { $in: ["ready", "published"] },
  };

  const videos = await Video.find(queryFilter)
    .sort({ views: -1 })
    .skip(skip)
    .limit(limit);

  const totalVideos = await Video.countDocuments(queryFilter);

  res.status(200).json({
    success: true,
    page,
    totalPages: Math.ceil(totalVideos / limit),
    videos,
  });
});

export const latestVideos = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const queryFilter = {
    visibility: "public",
    status: { $in: ["ready", "published"] },
  };

  const videos = await Video.find(queryFilter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalVideos = await Video.countDocuments(queryFilter);

  res.status(200).json({
    success: true,
    page,
    totalPages: Math.ceil(totalVideos / limit),
    videos,
  });
});

export const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.get("x-user-id");

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

  const safeQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const queryFilter = {
    title: { $regex: safeQuery, $options: "i" },
    visibility: "public",
    status: { $in: ["ready", "published"] },
  };

  const videos = await Video.find(queryFilter)
    .sort({ views: -1 })
    .skip(skip)
    .limit(limit);

  const totalVideos = await Video.countDocuments(queryFilter);

  res.status(200).json({
    success: true,
    page,
    totalPages: Math.ceil(totalVideos / limit),
    videos,
  });
});