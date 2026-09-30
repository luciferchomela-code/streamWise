import express from "express";
import {
  createChannel,
  getChannel,
  getMyChannel,
  updateChannel,
  deleteChannel,
  subscribe,
  unsubscribe,
  getMySubscriptions,
  getSubscribedVideos,
  checkSubscriptionStatus,
} from "../controllers/channel.controller.js";
import { requireGatewayIdentity } from "../middlewares/requireGatewayIdentity.js";

const router = express.Router();

// Protected routes (MUST BE DECLARED BEFORE /:channelId wildcard)
router.get("/me", requireGatewayIdentity, getMyChannel);
router.get("/subscriptions", requireGatewayIdentity, getMySubscriptions);
router.get("/subscriptions/videos", requireGatewayIdentity, getSubscribedVideos);
router.post("/", requireGatewayIdentity, createChannel);
router.put("/", requireGatewayIdentity, updateChannel);
router.delete("/", requireGatewayIdentity, deleteChannel);

// Interactions
router.post("/:channelId/subscribe", requireGatewayIdentity, subscribe);
router.delete("/:channelId/unsubscribe", requireGatewayIdentity, unsubscribe);
router.get("/:channelId/subscription-status", requireGatewayIdentity, checkSubscriptionStatus);

// Public routes (Wildcard route LAST)
router.get("/:channelId", getChannel);

export default router;