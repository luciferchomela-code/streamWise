import express from "express";
import {
  toggleLike,
  toggleDislike,
  incViewCount,
  addComment,
  deleteComment,
} from "../controllers/interaction.controller.js";
import { requireGatewayIdentity } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Apply authentication check to all routes in this file
router.use(requireGatewayIdentity);

router.post("/:videoId/like", toggleLike);
router.post("/:videoId/dislike", toggleDislike);
router.post("/:videoId/view", incViewCount);

router.post("/:videoId/comment", addComment);
router.delete("/comment/:commentId", deleteComment);

export default router;