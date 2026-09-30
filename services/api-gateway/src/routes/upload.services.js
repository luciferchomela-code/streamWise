import { Router } from "express";
import { isAuth } from "../middleware/isAuth.js";
import { createProxy } from "../utils/createProxy.js";

const router = Router();

const UPLOAD_SERVICE_URL = process.env.UPLOAD_SERVICE_URL || "http://localhost:5003";

const proxy = createProxy(UPLOAD_SERVICE_URL, "Upload service");

// ─── Image Routes (all protected) ─────────────────────────────────────────────
// GET  /api/upload/image/signature?type=thumbnail|avatar|banner
router.get("/image/signature", isAuth, proxy);

// DELETE /api/upload/image?publicId=...
router.delete("/image", isAuth, proxy);

// ─── Video Routes (all protected) ─────────────────────────────────────────────
// GET /api/upload/video/signature?videoId=...
router.get("/video/signature", isAuth, proxy);

// DELETE /api/upload/video?publicId=...
router.delete("/video", isAuth, proxy);

export default router;
