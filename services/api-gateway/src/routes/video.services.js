import { Router } from "express";
import { isAuth } from "../middleware/isAuth.js";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { createProxy } from "../utils/createProxy.js";

const router = Router();

const VIDEO_METADATA_SERVICE_URL =
  process.env.VIDEO_METADATA_SERVICE_URL || "http://localhost:5002";

const proxy = createProxy(VIDEO_METADATA_SERVICE_URL, "Video metadata service");

// ─── Video Routes ─────────────────────────────────────────────────────────────

// Static & Collection Routes (Public)
router.get("/trending", optionalAuth, proxy);
router.get("/popular", optionalAuth, proxy);
router.get("/latest", optionalAuth, proxy);
router.get("/search", optionalAuth, proxy);
router.get("/channel/:channelId", optionalAuth, proxy);

// Protected Actions
router.post("/draft", isAuth, proxy);
router.patch("/:videoId/finalize", isAuth, proxy);
router.delete("/:videoId", isAuth, proxy);

// Param-matched Single Resource (Public / Optional Auth)
router.get("/:videoId", optionalAuth, proxy);

export default router;