import express from "express";
import {
  createChannel,
  getChannel,
  getMyChannel,
  updateChannel,
  deleteChannel,
  subscribe,
  unsubscribe,
} from "../controllers/channel.controller.js";
import { requireGatewayIdentity } from "../middlewares/requireGatewayIdentity.js";

const router = express.Router();

// Protected routes (MUST BE DECLARED BEFORE /:channelId wildcard)
router.get("/me", requireGatewayIdentity, getMyChannel);
router.post("/", requireGatewayIdentity, createChannel);
router.put("/", requireGatewayIdentity, updateChannel);
router.delete("/", requireGatewayIdentity, deleteChannel);

// Interactions
router.post("/:channelId/subscribe", requireGatewayIdentity, subscribe);
router.delete("/:channelId/unsubscribe", requireGatewayIdentity, unsubscribe);

// Public routes (Wildcard route LAST)
router.get("/:channelId", getChannel);

export default router;