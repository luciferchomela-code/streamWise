import express from "express";
import {
  createDraft,
  channelVideos,
  deleteVideo,
  trendingVideos,
  latestVideos,
  getVideoById,
  searchVideos,
} from "../controllers/video.controller.js";
import { requireGatewayIdentity } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/trending", trendingVideos);
router.get("/latest", latestVideos);
router.get("/search", searchVideos);
router.get("/channel/:channelId", channelVideos);
router.get("/:videoId", getVideoById);

router.post("/draft", requireGatewayIdentity, createDraft);
router.delete("/:videoId", requireGatewayIdentity, deleteVideo);

export default router;