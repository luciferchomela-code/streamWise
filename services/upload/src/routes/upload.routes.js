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
import { requireGatewayIdentity } from "../middlewares/requireGatewayIdentity.js";
import { optionalGatewayIdentity } from "../middlewares/optionalGatewayIdentity.js";

const router = express.Router();

router.get("/image/signature", requireGatewayIdentity, getImageSignature);
router.delete("/image", requireGatewayIdentity, deleteImage);

router.get("/video/signature", requireGatewayIdentity, getVideoSignature);
router.delete("/video", requireGatewayIdentity, deleteVideo);

// ─── Stream Route ─────────────────────────────────────────────────────────────
// GET /api/stream/:videoId
// Public endpoint with optional gateway identity verification for private video checks.
router.get("/stream/:videoId", optionalGatewayIdentity, streamVideo);

export default router;
