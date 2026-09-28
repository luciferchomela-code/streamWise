import asyncHandler from "../middlewares/tryCatch.js";
import Video from "../../shared/models/video.model.js";
import VideoInteraction from "../../shared/models/videoInteraction.model.js";
import Comment from "../../shared/models/comments.model.js";

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
  const { watchPercentage = 30 } = req.body; 

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

  if (comment.authorId.toString() !== userId) {
    return res.status(403).json({ message: "Unauthorized to delete this comment." });
  }

  await Comment.deleteMany({ parentCommentId: commentId });
  await Comment.findByIdAndDelete(commentId);

  res.status(200).json({
    success: true,
    message: "Comment deleted successfully.",
  });
});