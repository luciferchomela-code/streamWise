import { Router } from "express";
import { isAuth } from "../middleware/isAuth.js";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { createProxy } from "../utils/createProxy.js";

const router = Router();

// Ensure environment variable points to channel/video service correctly
const CHANNEL_SERVICE_URL =
  process.env.CHANNEL_SERVICE_URL ||
  process.env.VIDEO_METADATA_SERVICE_URL ||
  "http://localhost:5002";

const proxy = createProxy(CHANNEL_SERVICE_URL, "Channel service");

// Protected Channel Actions (Root paths)
router.get("/me", isAuth, proxy);
router.get("/subscriptions", isAuth, proxy);
router.get("/subscriptions/videos", isAuth, proxy);
router.post("/", isAuth, proxy);
router.put("/", isAuth, proxy);
router.delete("/", isAuth, proxy);

// Protected Channel Interactions
router.post("/:channelId/subscribe", isAuth, proxy);
router.delete("/:channelId/unsubscribe", isAuth, proxy);
router.get("/:channelId/subscription-status", isAuth, proxy);

// Public Channel Fetching 
router.get("/:channelId", optionalAuth, proxy);

export default router;