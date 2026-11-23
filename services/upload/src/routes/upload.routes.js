import express from "express";
import {
  getImageSignature,
  deleteImageInternal,
} from "../controllers/Imageupload.controller.js";
import {
  getVideoSignature,
  verifyVideoInternal,
  deleteVideoInternal,
} from "../controllers/videoupload.controller.js";
import { streamVideo } from "../controllers/stream.controller.js";
import { requireGatewayIdentity } from "../middlewares/requireGatewayIdentity.js";
import { optionalGatewayIdentity } from "../middlewares/optionalGatewayIdentity.js";

const router = express.Router();

// ─── Image Routes ──────────────────────────────────────────────────────────────
// GET /api/upload/image/signature?type=thumbnail|avatar|banner
// Requires authenticated user forwarded by the gateway.
router.get("/image/signature", requireGatewayIdentity, getImageSignature);

// DELETE /api/upload/image/internal?publicId=...
// Internal server-to-server cleanup only — NOT exposed through the public gateway.
// Requires a valid gateway HMAC signature; called by metadata services after
// ownership has already been verified on their side.
router.delete("/image/internal", requireGatewayIdentity, deleteImageInternal);

// ─── Video Routes ──────────────────────────────────────────────────────────────
// GET /api/upload/video/signature?videoId=...
// Verifies the caller owns the draft before issuing a Cloudinary upload signature.
router.get("/video/signature", requireGatewayIdentity, getVideoSignature);
router.get("/video/internal", requireGatewayIdentity, verifyVideoInternal);

// DELETE /api/upload/video/internal?publicId=...
// Internal server-to-server cleanup only — NOT exposed through the public gateway.
// Requires a valid gateway HMAC signature; called by video-metadata after ownership
// has already been verified.
router.delete("/video/internal", requireGatewayIdentity, deleteVideoInternal);

// ─── Stream Route ─────────────────────────────────────────────────────────────
// GET /api/stream/:videoId
// Public endpoint with optional gateway identity verification for private video checks.
router.get("/stream/:videoId", optionalGatewayIdentity, streamVideo);

export default router;
