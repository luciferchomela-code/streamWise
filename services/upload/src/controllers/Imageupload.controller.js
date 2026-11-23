import {
  cloudinary,
  ensureCloudinaryConfig,
  generateImageSignature,
} from "../config/cloudinary.js";

// ─── GET /api/upload/image/signature ──────────────────────────────────────────
/**
 * Query: ?type=thumbnail | avatar | banner
 * Returns signed upload parameters so the frontend can upload directly to Cloudinary.
 * Bypasses Node.js server memory completely.
 *
 * Image uploads are not bound to a specific document ID (unlike videos) because
 * thumbnails and avatars are uploaded before — or independently of — a draft
 * creation.  Ownership is enforced at the metadata layer: createDraft / channel
 * update only accept URLs that were already uploaded by the authenticated user.
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

// ─── DELETE /api/upload/image/internal?publicId=... ───────────────────────────
/**
 * Internal server-to-server Cloudinary image cleanup route.
 *
 * Called ONLY by trusted internal services (e.g. video-metadata or channel
 * service) after they have already verified ownership server-side.
 *
 * The requireGatewayIdentity middleware (applied in the router) enforces the
 * HMAC — no browser caller can reach this directly.
 *
 * "not found" from Cloudinary is returned with 200 so the caller can safely
 * treat an already-deleted asset as a no-op.
 */
export const deleteImageInternal = async (req, res, next) => {
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
