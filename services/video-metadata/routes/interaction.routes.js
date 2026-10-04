import express from "express";
import {
  toggleLike,
  toggleDislike,
  incViewCount,
  getComments,
  addComment,
  deleteComment,
  toggleWatchLater,
  getWatchLater,
  checkVideoInteractionStatus,
  getWatchHistory,
  getContinueWatching,
} from "../controllers/interaction.controller.js";
import { requireGatewayIdentity } from "../middlewares/requireGatewayIdentity.js";
import { optionalGatewayIdentity } from "../middlewares/optionalGatewayIdentity.js";

const router = express.Router();

// History & Continue Watching
router.get("/history", requireGatewayIdentity, getWatchHistory);
router.get("/continue-watching", requireGatewayIdentity, getContinueWatching);

// Watch Later
router.get("/watch-later", requireGatewayIdentity, getWatchLater);
router.post("/:videoId/watch-later", requireGatewayIdentity, toggleWatchLater);
router.get("/:videoId/status", requireGatewayIdentity, checkVideoInteractionStatus);

// Public / Guest Allowed
router.get("/:videoId/comments", optionalGatewayIdentity, getComments);
router.post("/:videoId/view", optionalGatewayIdentity, incViewCount);

// Protected Interactions (Require Login)
router.post("/:videoId/like", requireGatewayIdentity, toggleLike);
router.post("/:videoId/dislike", requireGatewayIdentity, toggleDislike);
router.post("/:videoId/comment", requireGatewayIdentity, addComment);
router.delete("/comment/:commentId", requireGatewayIdentity, deleteComment);

export default router;