import express from "express";
import {
  getImageSignature,
  deleteImage,
} from "../controllers/upload.controller.js";

const router = express.Router();

/**
 * GET /api/upload/image/signature?type=thumbnail|avatar|banner
 * Generates signed params for direct browser -> Cloudinary uploads (Option B).
 */
router.get("/image/signature", getImageSignature);

/**
 * DELETE /api/upload/image?publicId=streamwise/thumbnails/xyz
 */
router.delete("/image", deleteImage);

export default router;
