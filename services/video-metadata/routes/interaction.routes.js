import express from "express";
import {
  toggleLike,
  toggleDislike,
  incViewCount,
  getComments,
  addComment,
  deleteComment,
} from "../controllers/interaction.controller.js";
import { requireGatewayIdentity } from "../middlewares/requireGatewayIdentity.js";
import { optionalGatewayIdentity } from "../middlewares/optionalGatewayIdentity.js";

const router = express.Router();

// Public / Guest Allowed
router.get("/:videoId/comments", optionalGatewayIdentity, getComments);
router.post("/:videoId/view", optionalGatewayIdentity, incViewCount);

// Protected Interactions (Require Login)
router.post("/:videoId/like", requireGatewayIdentity, toggleLike);
router.post("/:videoId/dislike", requireGatewayIdentity, toggleDislike);
router.post("/:videoId/comment", requireGatewayIdentity, addComment);
router.delete("/comment/:commentId", requireGatewayIdentity, deleteComment);

export default router;