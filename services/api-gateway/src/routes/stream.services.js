import { Router } from "express";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { createProxy } from "../utils/createProxy.js";

const router = Router();

const UPLOAD_SERVICE_URL = process.env.UPLOAD_SERVICE_URL || "http://localhost:5003";

// Reuse the same upload-service proxy — stream controller lives there
const proxy = createProxy(UPLOAD_SERVICE_URL, "Upload service (stream)");

// ─── Stream Route ──────────────────────────────────────────────────────────────
// GET /api/stream/:videoId
//
// optionalAuth: public videos work without a token.
//               logged-in users get x-user-id forwarded so private videos work.
//
// The proxy sends the request to upload-service → stream.controller.js
// which does a 302 redirect to Cloudinary CDN.
// The gateway never sees a single video byte.
router.get("/:videoId", optionalAuth, proxy);

export default router;
