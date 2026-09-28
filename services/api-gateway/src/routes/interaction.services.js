import { Router } from "express";
import { isAuth } from "../middleware/isAuth.js";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { createProxy } from "../utils/createProxy.js";

const router = Router();

const VIDEO_METADATA_SERVICE_URL =
  process.env.VIDEO_METADATA_SERVICE_URL || "http://localhost:5002";

const proxy = createProxy(VIDEO_METADATA_SERVICE_URL, "Interaction service");

// Public / Guest Allowed
router.get("/:videoId/comments", optionalAuth, proxy);
router.post("/:videoId/view", optionalAuth, proxy);

// Protected Interactions (Require Login)
router.post("/:videoId/like", isAuth, proxy);
router.post("/:videoId/dislike", isAuth, proxy);
router.post("/:videoId/comment", isAuth, proxy);
router.delete("/comment/:commentId", isAuth, proxy);

export default router;