import asyncHandler from "../middlewares/tryCatch.js";
import { WatchPartyManager } from "../utils/watchPartySync.js";

const manager = new WatchPartyManager();

export const getPartySnapshot = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const room = manager.getRoom(roomId);
  if (!room) {
    return res.status(404).json({ message: "Watch party room not found" });
  }
  res.status(200).json({ success: true, room: room.getSnapshot() });
});

export const joinParty = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { videoId } = req.body || {};
  const userId = req.auth ? req.auth.userId : `guest_${Date.now()}`;

  let room = manager.getRoom(roomId);
  if (!room) {
    if (!videoId) {
      return res.status(400).json({ message: "videoId is required to initialize a watch party" });
    }
    room = manager.getOrCreateRoom({ roomId, hostId: userId, videoId, position: 0 });
  }

  const snapshot = room.join(userId);
  res.status(200).json({ success: true, room: snapshot });
});

export const applyPartyAction = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { action, position, revision, videoId } = req.body || {};
  const userId = req.auth.userId;

  const room = manager.getRoom(roomId);
  if (!room) {
    return res.status(404).json({ message: "Watch party room not found" });
  }

  const result = room.applyAction({ action, position, revision, videoId, hostId: userId });
  if (!result.applied) {
    return res.status(result.reason === "unauthorized" ? 403 : 409).json({
      message: result.reason === "unauthorized" ? "Only host can control playback" : "Stale or out-of-order action",
      currentRevision: room.revision,
    });
  }

  res.status(200).json({ success: true, room: result.snapshot });
});
