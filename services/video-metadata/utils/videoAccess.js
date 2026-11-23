import mongoose from "mongoose";
import Video from "../../shared/models/video.model.js";
import Channel from "../../shared/models/channel.model.js";
import { CreatorBlock } from "../models/features.js";

export const blockedChannelIds = async (userId) => new Set(userId
  ? (await CreatorBlock.distinct("channelId", { userId })).map(String)
  : []);

export const isBlocked = async (userId, channelId) =>
  Boolean(userId && await CreatorBlock.exists({ userId, channelId }));

export const canWatch = async (video, userId) =>
  Boolean(video && ["ready", "published"].includes(video.status) &&
    !await isBlocked(userId, video.channelId) &&
    (video.visibility !== "private" ||
     (userId && await Channel.exists({ _id: video.channelId, ownerId: userId }))));

export const findPlayableVideo = async (videoId, userId) => {
  if (!mongoose.isObjectIdOrHexString(videoId)) return null;
  const video = await Video.findById(videoId);
  return await canWatch(video, userId) ? video : null;
};
