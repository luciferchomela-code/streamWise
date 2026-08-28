import asyncHandler from "../middlewares/tryCatch.js";
import Video from "../../shared/models/video.model.js";
import VideoInteraction from "../../shared/models/videoInteraction.model.js";
import Comment from "../../shared/models/comments.model.js";

export const toggleLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.auth.userId;

  const video = await Video.findById(videoId);
  if (!video) {
    return res.status(404).json({ message: "Video not found." });
  }

  let interaction = await VideoInteraction.findOne({ userId, videoId });
  let videoInc = {};
  let message = "";

  if (!interaction) {
    interaction = new VideoInteraction({ userId, videoId, liked: true, disliked: false });
    videoInc.likes = 1;
    message = "Video liked successfully";
  } else if (interaction.liked) {
    interaction.liked = false;
    videoInc.likes = -1;
    message = "Like removed successfully";
  } else {
    if (interaction.disliked) {
      interaction.disliked = false;
      videoInc.dislikes = -1;
    }
    interaction.liked = true;
    videoInc.likes = 1;
    message = "Video liked successfully";
  }

  await interaction.save();

  // Only query the Video collection if there is a count change
  let updatedVideo = video;
  if (Object.keys(videoInc).length > 0) {
    updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      { $inc: videoInc },
      { new: true }
    );
  }

  res.status(200).json({
    success: true,
    message,
    likes: Math.max(0, updatedVideo.likes),
    dislikes: Math.max(0, updatedVideo.dislikes),
    interaction,
  });
});

export const toggleDislike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.auth.userId;

  const video = await Video.findById(videoId);
  if (!video) {
    return res.status(404).json({ message: "Video not found." });
  }

  let interaction = await VideoInteraction.findOne({ userId, videoId });
  let videoInc = {};
  let message = "";

  if (!interaction) {
    interaction = new VideoInteraction({ userId, videoId, liked: false, disliked: true });
    videoInc.dislikes = 1;
    message = "Video disliked successfully";
  } else if (interaction.disliked) {
    interaction.disliked = false;
    videoInc.dislikes = -1;
    message = "Dislike removed successfully";
  } else {
    if (interaction.liked) {
      interaction.liked = false;
      videoInc.likes = -1;
    }
    interaction.disliked = true;
    videoInc.dislikes = 1;
    message = "Video disliked successfully";
  }

  await interaction.save();

  let updatedVideo = video;
  if (Object.keys(videoInc).length > 0) {
    updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      { $inc: videoInc },
      { new: true }
    );
  }

  res.status(200).json({
    success: true,
    message,
    likes: Math.max(0, updatedVideo.likes),
    dislikes: Math.max(0, updatedVideo.dislikes),
    interaction,
  });
});

export const incViewCount = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.auth.userId;
  const { watchPercentage = 0 } = req.body; 

  if (watchPercentage < 30) {
    return res.status(400).json({
      success: false,
      message: "Video must be watched for at least 30% to count as a view.",
    });
  }

  const video = await Video.findById(videoId);
  if (!video) {
    return res.status(404).json({ message: "Video not found." });
  }

  let interaction = await VideoInteraction.findOne({ userId, videoId });
  const now = new Date();
  let shouldIncrementGlobalViews = false;

  // View Cooldown (1 hour) to prevent view-botting by the same user
  const ONE_HOUR_MS = 60 * 60 * 1000; 

  if (!interaction) {
    shouldIncrementGlobalViews = true;
    interaction = await VideoInteraction.create({
      userId,
      videoId,
      viewCount: 1,
      watchPercentage,
      lastViewedAt: now,
    });
  } else {
    interaction.watchPercentage = Math.max(interaction.watchPercentage, watchPercentage);
    
    if (now - interaction.lastViewedAt > ONE_HOUR_MS) {
      shouldIncrementGlobalViews = true;
      interaction.viewCount += 1;
      interaction.lastViewedAt = now;
    }
    await interaction.save();
  }

  let updatedVideo = video;
  if (shouldIncrementGlobalViews) {
    updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      { $inc: { views: 1 } },
      { new: true }
    );
  }

  res.status(200).json({
    success: true,
    message: shouldIncrementGlobalViews ? "View count incremented" : "Watch percentage updated",
    views: updatedVideo.views,
  });
});

export const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.auth.userId;
  const { commentText, parentCommentId = null } = req.body;

  if (!commentText || !commentText.trim()) {
    return res.status(400).json({ message: "Comment body is required." });
  }

  if (parentCommentId) {
    const parentComment = await Comment.findById(parentCommentId);
    if (!parentComment) {
      return res.status(404).json({ message: "Parent comment not found." });
    }
    if (parentComment.parentCommentId) {
      return res.status(400).json({ message: "Nested replies beyond level 1 are not allowed." });
    }
  }

  const comment = await Comment.create({
    videoId,
    authorId: userId,
    body: commentText.trim(),
    parentCommentId,
  });

  res.status(201).json({ success: true, comment });
});

export const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.auth.userId;

  const comment = await Comment.findById(commentId);
  if (!comment) {
    return res.status(404).json({ message: "Comment not found." });
  }

  if (comment.authorId.toString() !== userId) {
    return res.status(403).json({ message: "Unauthorized to delete this comment." });
  }

  await Comment.deleteMany({ parentCommentId: commentId });
  await Comment.findByIdAndDelete(commentId);

  res.status(200).json({
    success: true,
    message: "Comment and associated replies deleted successfully.",
  });
});