import express from "express";
import {
  createChannel,
  getChannel,
  updateChannel,
  deleteChannel,
  subscribe,
  unsubscribe,
} from "../controllers/channel.controller.js";
import { requireGatewayIdentity } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/:channelId", getChannel);

//// Protected routes (Require Auth)
router.post("/", requireGatewayIdentity, createChannel);
router.put("/", requireGatewayIdentity, updateChannel);
router.delete("/", requireGatewayIdentity, deleteChannel);

// Interactions
router.post("/:channelId/subscribe", requireGatewayIdentity, subscribe);
router.delete("/:channelId/unsubscribe", requireGatewayIdentity, unsubscribe);

export default router;