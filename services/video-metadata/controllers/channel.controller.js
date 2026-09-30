import asyncHandler from "../middlewares/tryCatch.js";
import Channel from "../../shared/models/channel.model.js";
import ChannelInteraction from "../../shared/models/channelInteraction.model.js";
import Video from "../../shared/models/video.model.js";

export const createChannel = asyncHandler(async (req, res) => {
  const { name, imageUrl, description, handle, category } = req.body;
  const userId = req.auth.userId;

  const existingChannel = await Channel.findOne({ ownerId: userId });
  if (existingChannel) {
    return res.status(400).json({ message: "User already owns a channel.", channel: existingChannel });
  }

  const channel = await Channel.create({
    name,
    ownerId: userId,
    image: imageUrl || null,
    description: description || "",
    handle: handle ? handle.toLowerCase().replace(/[^a-z0-9_]/g, '') : name.toLowerCase().replace(/\s+/g, ''),
    category: category || "General",
  });

  res.status(201).json({ success: true, channel });
});

export const getChannel = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const channel = await Channel.findById(channelId);

  if (!channel) {
    return res.status(404).json({ message: "Channel not found." });
  }

  res.status(200).json({ success: true, channel });
});

export const getMyChannel = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const channel = await Channel.findOne({ ownerId: userId });

  if (!channel) {
    return res.status(404).json({ message: "Channel not found." });
  }

  res.status(200).json({ success: true, channel });
});

export const updateChannel = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const { name, imageUrl, description, handle, category } = req.body;

  const channel = await Channel.findOne({ ownerId: userId });
  if (!channel) {
    return res.status(404).json({ message: "Channel not found." });
  }

  if (name) channel.name = name;
  if (imageUrl) channel.image = imageUrl;
  if (description !== undefined) channel.description = description;
  if (handle) channel.handle = handle.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (category) channel.category = category;

  await channel.save();
  res.status(200).json({ success: true, channel });
});

export const deleteChannel = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  
  // Use findOne to get the ID for cascading deletes before removing
  const channel = await Channel.findOne({ ownerId: userId });
  if (!channel) {
    return res.status(404).json({ message: "Channel not found." });
  }

  await Channel.findByIdAndDelete(channel._id);
  await ChannelInteraction.deleteMany({ channelId: channel._id });

  res.status(200).json({ success: true, message: "Channel deleted successfully" });
});

export const subscribe = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const userId = req.auth.userId;

  const channel = await Channel.findById(channelId);
  if (!channel) {
    return res.status(404).json({ message: "Channel not found." });
  }

  if (channel.ownerId.toString() === userId) {
    return res.status(400).json({ message: "You cannot subscribe to your own channel." });
  }

  try {
    const channelInteraction = await ChannelInteraction.create({
      userId,
      channelId,
      subscribed: true,
    });

    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $inc: { subscribersCount: 1 } },
      { new: true }
    );

    res.status(200).json({ success: true, channel: updatedChannel, channelInteraction });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Already subscribed to this channel." });
    }
    throw error;
  }
});

export const unsubscribe = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const userId = req.auth.userId;

  const deletedInteraction = await ChannelInteraction.findOneAndDelete({
    userId,
    channelId,
  });

  if (!deletedInteraction) {
    return res.status(400).json({ message: "You are not subscribed to this channel." });
  }

  const updatedChannel = await Channel.findOneAndUpdate(
    { _id: channelId, subscribersCount: { $gt: 0 } },
    { $inc: { subscribersCount: -1 } },
    { new: true }
  );

  res.status(200).json({
    success: true,
    channel: updatedChannel,
    channelInteraction: deletedInteraction,
  });
});

export const getMySubscriptions = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;

  const subscriptions = await ChannelInteraction.find({ userId, subscribed: true })
    .sort({ updatedAt: -1 })
    .populate("channelId");

  const channels = subscriptions
    .filter((sub) => sub.channelId)
    .map((sub) => sub.channelId);

  res.status(200).json({
    success: true,
    channels,
  });
});

export const checkSubscriptionStatus = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const userId = req.auth.userId;

  const interaction = await ChannelInteraction.findOne({ userId, channelId });
  res.status(200).json({
    success: true,
    subscribed: !!(interaction && interaction.subscribed),
  });
});

export const getSubscribedVideos = asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const skip = (page - 1) * limit;

  const subscriptions = await ChannelInteraction.find({ userId, subscribed: true }).select("channelId");
  const channelIds = subscriptions.map((sub) => sub.channelId);

  if (channelIds.length === 0) {
    return res.status(200).json({
      success: true,
      page: 1,
      totalPages: 0,
      videos: [],
    });
  }

  const queryFilter = {
    channelId: { $in: channelIds },
    visibility: "public",
    status: { $in: ["ready", "published"] },
  };

  const [videos, totalVideos] = await Promise.all([
    Video.find(queryFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("channelId", "name image handle subscribersCount"),
    Video.countDocuments(queryFilter),
  ]);

  res.status(200).json({
    success: true,
    page,
    totalPages: Math.ceil(totalVideos / limit),
    videos,
  });
});