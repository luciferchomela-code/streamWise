import { Router } from "express";
import { isAuth } from "../middleware/isAuth.js";
import { createProxy } from "../utils/createProxy.js";

const router = Router();

const UPLOAD_SERVICE_URL = process.env.UPLOAD_SERVICE_URL || "http://localhost:5003";

const proxy = createProxy(UPLOAD_SERVICE_URL, "Upload service");

// ─── Upload Routes (all protected) ───────────────────────────────────────────

// POST /api/upload/image?type=thumbnail|avatar|banner
// Accepts: multipart/form-data  field: "image"
router.post("/image", isAuth, proxy);

// DELETE /api/upload/image?publicId=...
router.delete("/image", isAuth, proxy);

export default router;
