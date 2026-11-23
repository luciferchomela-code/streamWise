import {
  cloudinary,
  ensureCloudinaryConfig,
  generateVideoSignature,
} from "../config/cloudinary.js";
import { fetchVideoDoc } from "../utils/fetchVideoDoc.js";

// ─── GET /api/upload/video/signature?videoId=... ──────────────────────────────
/**
 * Before issuing a Cloudinary upload signature, verify the authenticated user
 * owns the video draft (via the channel relationship stored in video-metadata).
 *
 * Two layers of ownership enforcement:
 *   1. fetchVideoDoc forwards the signed userId → video-metadata already rejects
 *      non-owners of draft videos with 403.
 *   2. This controller independently re-checks channelId.ownerId === userId,
 *      so the ownership check is local and cannot be bypassed even if the
 *      metadata service behaviour changes.
 *
 * The signature is bound to a server-controlled publicId derived from the videoId,
 * preventing a caller from hijacking another user's Cloudinary asset slot.
 */
export const getVideoSignature = async (req, res, next) => {
  try {
    const { videoId } = req.query;
    const userId = req.auth?.userId;

    if (!videoId) {
      return res.status(400).json({ message: "videoId query param is required." });
    }

    // Fetch the video draft from the metadata service, forwarding signed identity.
    // If the caller does not own the draft, video-metadata returns 401/403 and
    // fetchVideoDoc throws with the matching statusCode.
    let video;
    try {
      video = await fetchVideoDoc(videoId, userId);
    } catch (err) {
      return res.status(err.statusCode || 404).json({
        message: err.message || "Video draft not found.",
      });
    }

    // Independent ownership re-check using the populated channel embedded in the doc.
    // channelId is populated by video-metadata's getVideoById (.populate("channelId")).
    const channelOwnerId =
      video.channelId?.ownerId?.toString?.() ?? null;

    if (!channelOwnerId || channelOwnerId !== userId) {
      return res.status(403).json({
        message: "Forbidden: you do not own this video draft.",
      });
    }

    // Reject re-upload attempts on already-finalized videos.
    if (video.status !== "draft" && video.status !== "uploading") {
      return res.status(409).json({
        message: "Video is already finalized and cannot be re-uploaded.",
      });
    }

    // Generate a Cloudinary signature whose publicId is deterministically tied
    // to the MongoDB _id — the browser cannot substitute a different asset slot.
    const signatureData = generateVideoSignature(videoId);

    return res.status(200).json({
      success: true,
      videoId,
      ...signatureData,
    });
  } catch (error) {
    next(error);
  }
};

// Verify the draft asset using Cloudinary credentials held by this service.
export const verifyVideoInternal = async (req, res, next) => {
  try {
    const { videoId, publicId } = req.query;
    if (typeof videoId !== "string" || !/^[a-f0-9]{24}$/.test(videoId) ||
        ![`streamwise/videos/${videoId}`, `streamwise/videos/streamwise/videos/${videoId}`].includes(publicId)) {
      return res.status(400).json({ message: "Invalid video asset." });
    }

    ensureCloudinaryConfig();
    const asset = await cloudinary.api.resource(publicId, {
      resource_type: "video",
      type: "upload",
      media_metadata: true,
      timeout: 5000,
    });
    const duration = asset.duration ?? asset.video?.duration ?? asset.media_metadata?.duration;
    if (asset.public_id !== publicId || !asset.secure_url ||
        !Number.isFinite(duration) || duration <= 0) {
      return res.status(422).json({ message: "The uploaded asset is not a playable video." });
    }

    const mediaUrl = (options) => cloudinary.url(publicId, {
      resource_type: "video", secure: true, version: asset.version, ...options,
    });
    const frame = (time, width) => mediaUrl({
      format: "jpg", transformation: [{ start_offset: time, width, crop: "limit" }],
    });
    return res.json({
      publicId: asset.public_id,
      videoUrl: asset.secure_url,
      baselineUrl: mediaUrl({ format: "m3u8", streaming_profile: "auto:maxres_480p" }),
      hlsUrl: mediaUrl({ format: "m3u8", streaming_profile: "auto" }),
      thumbnailUrl: frame(Number((duration / 2).toFixed(2)), 800),
      storyboard: Array.from({ length: 8 }, (_, index) => {
        const time = Number((duration * index / 8).toFixed(3));
        return { time, url: frame(time, 240) };
      }),
      duration,
    });
  } catch (error) {
    if ((error.http_code ?? error.error?.http_code) === 404) {
      return res.status(404).json({ message: "Cloudinary has not confirmed the upload." });
    }
    next(error);
  }
};

// ─── DELETE /api/upload/video/internal?publicId=... ───────────────────────────
/**
 * Internal server-to-server Cloudinary cleanup route.
 *
 * Called ONLY by the video-metadata service after it has already verified
 * ownership and is about to delete the video document.  The gateway does NOT
 * expose this path to browsers — it is only reachable via the internal
 * UPLOAD_SERVICE_INTERNAL_URL network.
 *
 * The requireGatewayIdentity middleware (applied in the router) enforces the
 * HMAC so any direct call without a valid signed timestamp is rejected with 403.
 *
 * "not found" from Cloudinary is returned as-is with status 200 so the caller
 * can treat an already-deleted asset as a no-op and continue safely.
 */
export const deleteVideoInternal = async (req, res, next) => {
  try {
    const { publicId } = req.query;

    if (!publicId) {
      return res.status(400).json({ message: "publicId query param is required." });
    }

    ensureCloudinaryConfig();

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "video",
    });

    // result.result is "ok" on success or "not found" if already deleted.
    // Both are returned as 200 so the caller can safely retry deletion.
    return res.status(200).json({ success: true, result: result.result });
  } catch (error) {
    next(error);
  }
};
