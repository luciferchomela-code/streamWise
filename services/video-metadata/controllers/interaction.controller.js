import asyncHandler from "../middlewares/tryCatch.js";
import Video from "../../shared/models/video.model.js";
import VideoInteraction from "../../shared/models/videoInteraction.model.js";
import Comment from "../../shared/models/comments.model.js";
import Channel from "../../shared/models/channel.model.js";
import User from "../../shared/models/user.model.js";
import { publishEvent } from "../../shared/config/rabbitmq.js";


export const toggleLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.auth.userId;

  const previousInteraction = await VideoInteraction.findOne({ userId, videoId });
  let videoInc = {};
  let message = "";
  
  let newLikedState = true;
  let newDislikedState = false;

  if (!previousInteraction) {
    videoInc.likes = 1;
    message = "Video liked successfully";
  } else if (previousInteraction.liked) {
    newLikedState = false;
    videoInc.likes = -1;
    message = "Like removed successfully";
  } else {
    if (previousInteraction.disliked) {
      videoInc.dislikes = -1;
    }
    videoInc.likes = 1;
    message = "Video liked successfully";
  }

  const interaction = await VideoInteraction.findOneAndUpdate(
    { userId, videoId },
    { $set: { liked: newLikedState, disliked: newDislikedState } },
    { new: true, upsert: true }
  );

  let updatedVideo = await Video.findById(videoId);
  if (!updatedVideo) return res.status(404).json({ message: "Video not found." });

  if (Object.keys(videoInc).length > 0) {
    updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      { $inc: videoInc },
      { new: true }
    );
  }

  void publishEvent("video.liked", {
    videoId,
    userId,
    liked: newLikedState,
    likes: Math.max(0, updatedVideo.likes || 0),
    dislikes: Math.max(0, updatedVideo.dislikes || 0),
    interactionId: interaction?._id?.toString?.() || null,
  });

  res.status(200).json({
    success: true,
    message,
    likes: Math.max(0, updatedVideo.likes || 0),
    dislikes: Math.max(0, updatedVideo.dislikes || 0),
    interaction,
  });
});

export const toggleDislike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.auth.userId;

  const previousInteraction = await VideoInteraction.findOne({ userId, videoId });
  let videoInc = {};
  let message = "";
  
  let newLikedState = false;
  let newDislikedState = true;

  if (!previousInteraction) {
    videoInc.dislikes = 1;
    message = "Video disliked successfully";
  } else if (previousInteraction.disliked) {
    newDislikedState = false;
    videoInc.dislikes = -1;
    message = "Dislike removed successfully";
  } else {
    if (previousInteraction.liked) {
      videoInc.likes = -1;
    }
    videoInc.dislikes = 1;
    message = "Video disliked successfully";
  }

  const interaction = await VideoInteraction.findOneAndUpdate(
    { userId, videoId },
    { $set: { liked: newLikedState, disliked: newDislikedState } },
    { new: true, upsert: true }
  );

  let updatedVideo = await Video.findById(videoId);
  if (!updatedVideo) return res.status(404).json({ message: "Video not found." });

  if (Object.keys(videoInc).length > 0) {
    updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      { $inc: videoInc },
      { new: true }
    );
  }

  void publishEvent("video.disliked", {
    videoId,
    userId,
    disliked: newDislikedState,
    likes: Math.max(0, updatedVideo.likes || 0),
    dislikes: Math.max(0, updatedVideo.dislikes || 0),
    interactionId: interaction?._id?.toString?.() || null,
  });

  res.status(200).json({
    success: true,
    message,
    likes: Math.max(0, updatedVideo.likes || 0),
    dislikes: Math.max(0, updatedVideo.dislikes || 0),
    interaction,
  });
});

export const incViewCount = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.auth ? req.auth.userId : null;
  const { watchPercentage = 30, lastWatchedPosition = 0 } = req.body; 

  const video = await Video.findById(videoId);
  if (!video) {
    return res.status(404).json({ message: "Video not found." });
  }

  let updatedVideo = video;
  if (userId) {
    let interaction = await VideoInteraction.findOne({ userId, videoId });
    const now = new Date();
    let shouldIncrementGlobalViews = false;
    const ONE_HOUR_MS = 60 * 60 * 1000; 

    if (!interaction) {
      shouldIncrementGlobalViews = true;
      interaction = await VideoInteraction.create({
        userId,
        videoId,
        viewCount: 1,
        watchPercentage,
        lastWatchedPosition,
        lastViewedAt: now,
      });
    } else {
      // Always update position and percentage
      if (watchPercentage > 0) {
        interaction.watchPercentage = Math.max(interaction.watchPercentage, watchPercentage);
      }
      if (lastWatchedPosition > 0) {
        interaction.lastWatchedPosition = Math.max(interaction.lastWatchedPosition, lastWatchedPosition);
      }
      const previousLastViewedAt = interaction.lastViewedAt;
      interaction.lastViewedAt = now;
      // Increment viewCount once per hour per video
      if (!previousLastViewedAt || (now - new Date(previousLastViewedAt) > ONE_HOUR_MS)) {
        shouldIncrementGlobalViews = true;
        interaction.viewCount = (interaction.viewCount || 0) + 1;
      }
      await interaction.save();
    }

    if (shouldIncrementGlobalViews) {
      updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        { $inc: { views: 1 } },
        { new: true }
      );
    }
  } else {
    // Guest view
    updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      { $inc: { views: 1 } },
      { new: true }
    );
  }

  void publishEvent("video.viewed", {
    videoId,
    userId,
    watchPercentage,
    lastWatchedPosition,
    views: updatedVideo.views,
  });

  res.status(200).json({
    success: true,
    views: updatedVideo.views,
  });
});

export const getComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const comments = await Comment.find({ videoId })
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
  const video = await Video.findById(videoId).select('_id channelId');
  if (!video) {
    return res.status(404).json({ message: "Video not found." });
  }

  const comment = await Comment.create({
    videoId,
    authorId: userId,
    body: commentText.trim(),
    parentCommentId,
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

  const videos = interactions
    .filter((i) => i.videoId)
    .map((i) => i.videoId);

  res.status(200).json({
    success: true,
    page,
    totalPages: Math.ceil(total / limit),
    total,
    videos,
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

  const history = interactions
    .filter((i) => i.videoId)
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
    history,
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

  const continueWatching = interactions
    .filter((i) => i.videoId)
    .map((i) => ({
      ...i.videoId.toObject(),
      lastWatchedPosition: i.lastWatchedPosition,
      watchPercentage: i.watchPercentage,
    }));

  res.status(200).json({
    success: true,
    continueWatching,
  });
});