import { Router } from "express";
import { isAuth } from "../middleware/isAuth.js";
import { createProxy } from "../utils/createProxy.js";

const router = Router();

const UPLOAD_SERVICE_URL = process.env.UPLOAD_SERVICE_URL || "http://localhost:5003";

const proxy = createProxy(UPLOAD_SERVICE_URL, "Upload service");

// ─── Image Routes (all protected) ─────────────────────────────────────────────
// GET  /api/upload/image/signature?type=thumbnail|avatar|banner
router.get("/image/signature", isAuth, proxy);

// NOTE: DELETE /image/internal is NOT exposed here — it is an internal-only
// server-to-server route called directly by metadata services using the
// UPLOAD_SERVICE_INTERNAL_URL env var, with a signed gateway identity header.
// Exposing it here would let any logged-in browser caller delete arbitrary images.

// ─── Video Routes (all protected) ─────────────────────────────────────────────
// GET /api/upload/video/signature?videoId=...
// The upload service verifies draft ownership before issuing the Cloudinary signature.
router.get("/video/signature", isAuth, proxy);

// NOTE: DELETE /video/internal is NOT exposed here — video deletion is initiated
// via DELETE /api/videos/:videoId on the video-metadata service, which then calls
// the upload service internally after verifying ownership.

export default router;
