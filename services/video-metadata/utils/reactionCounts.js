import { Types } from "mongoose";
import VideoInteraction from "../../shared/models/videoInteraction.model.js";

const emptyCounts = { likes: 0, dislikes: 0 };

const countReactions = (videoIds, session) => VideoInteraction.aggregate([
  { $match: {
    videoId: { $in: videoIds.map((id) => new Types.ObjectId(id)) },
    $or: [{ liked: true }, { disliked: true }],
  } },
  { $group: {
    _id: "$videoId",
    likes: { $sum: { $cond: ["$liked", 1, 0] } },
    dislikes: { $sum: { $cond: ["$disliked", 1, 0] } },
  } },
]).session(session ?? null);

export const getReactionCounts = async (videoId, session) => {
  const [counts] = await countReactions([videoId], session);
  return counts ? { likes: counts.likes, dislikes: counts.dislikes } : emptyCounts;
};

export const withReactionCounts = async (videos) => {
  if (!videos.length) return videos;
  const counts = await countReactions(videos.map((video) => video._id));
  const byId = new Map(counts.map(({ _id, likes, dislikes }) => [String(_id), { likes, dislikes }]));
  return videos.map((video) => ({
    ...(video.toObject ? video.toObject() : video),
    ...(byId.get(String(video._id)) || emptyCounts),
  }));
};
