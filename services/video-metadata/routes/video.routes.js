import express from "express";
import {
  createDraft,
  finalizeVideo,
  channelVideos,
  deleteVideo,
  trendingVideos,
  mostPopularVideos,
  getVideoById,
  searchVideos,
} from "../controllers/video.controllers.js";
import { requireGatewayIdentity } from "../middlewares/requireGatewayIdentity.js";
import { optionalGatewayIdentity } from "../middlewares/optionalGatewayIdentity.js";

const router = express.Router();

router.get("/trending", optionalGatewayIdentity, trendingVideos);
router.get("/popular", optionalGatewayIdentity, mostPopularVideos);
router.get("/search", optionalGatewayIdentity, searchVideos);
router.get("/channel/:channelId", optionalGatewayIdentity, channelVideos);
router.get("/:videoId", optionalGatewayIdentity, getVideoById);

router.post("/draft", requireGatewayIdentity, createDraft);
router.patch("/:videoId/finalize", requireGatewayIdentity, finalizeVideo);
router.delete("/:videoId", requireGatewayIdentity, deleteVideo);

export default router;