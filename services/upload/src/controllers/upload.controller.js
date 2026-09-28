import {
  cloudinary,
  ensureCloudinaryConfig,
  generateImageSignature,
} from "../config/cloudinary.js";

// ─── GET /api/upload/image/signature ──────────────────────────────────────────
/**
 * Query: ?type=thumbnail | avatar | banner
 * Returns signed upload parameters so the frontend can upload directly to Cloudinary.
 * Bypasses Node.js server memory completely!
 */
export const getImageSignature = async (req, res, next) => {
  try {
    const imageType = ["thumbnail", "avatar", "banner"].includes(req.query.type)
      ? req.query.type
      : "image";

    const signatureData = generateImageSignature(imageType);

    return res.status(200).json({
      success: true,
      imageType,
      ...signatureData,
    });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /api/upload/image?publicId=... ────────────────────────────────────
export const deleteImage = async (req, res, next) => {
  try {
    const { publicId } = req.query;

    if (!publicId) {
      return res.status(400).json({ message: "publicId query param is required." });
    }

    ensureCloudinaryConfig();

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });

    return res.status(200).json({ success: true, result: result.result });
  } catch (error) {
    next(error);
  }
};
