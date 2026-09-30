import express from "express";
import {
  getImageSignature,
  deleteImage,
} from "../controllers/Imageupload.controller.js";
import {
  getVideoSignature,
  deleteVideo,
} from "../controllers/videoupload.controller.js";
import { streamVideo } from "../controllers/stream.controller.js";

const router = express.Router();

router.get("/image/signature", getImageSignature);
router.delete("/image", deleteImage);

router.get("/video/signature", getVideoSignature);
router.delete("/video", deleteVideo);

// ─── Stream Route ─────────────────────────────────────────────────────────────
// GET /api/stream/:videoId
// Public endpoint — auth forwarded via x-user-id header for private video checks.
// 302 redirects to Cloudinary CDN — Node.js never touches a single video byte.
router.get("/stream/:videoId", streamVideo);

export default router;

