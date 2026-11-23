

import crypto from "crypto";
import { cloudinary, ensureCloudinaryConfig } from "../config/cloudinary.js";
import { fetchVideoDoc } from "../utils/fetchVideoDoc.js";
import { createGatewaySignature } from "../utils/gatewaySignature.js";

const SIGNED_URL_TTL_SECONDS = 60 * 60; 
const VIDEO_METADATA_INTERNAL_URL =
  process.env.VIDEO_METADATA_INTERNAL_URL || "http://localhost:5002";

const buildSignedUrl = (publicId, profile) => {
  ensureCloudinaryConfig();

  const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;

  return cloudinary.url(publicId, {
    resource_type: "video",
    type: "upload",
    streaming_profile: profile,
    format: "m3u8",
    secure: true,
    sign_url: true,
    expires_at: expiresAt,
  });
};

const incrementViewCount = (videoId, userId) => {
  const headers = { "Content-Type": "application/json" };
  if (userId) {
    const timestamp = Date.now();
    const requestId = crypto.randomUUID();
    const signature = createGatewaySignature({ userId, requestId, timestamp });
    headers["x-user-id"] = userId;
    headers["x-request-id"] = requestId;
    headers["x-gateway-timestamp"] = timestamp.toString();
    headers["x-gateway-signature"] = signature;
  }

  fetch(`${VIDEO_METADATA_INTERNAL_URL}/api/interactions/view/${videoId}`, {
    method: "POST",
    headers,
  }).catch((err) => {
    console.warn(`[stream] View count increment failed for ${videoId}:`, err.message);
  });
};

export const streamVideo = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const userId = req.auth?.userId || null;
    const video = await fetchVideoDoc(videoId, userId);

    if (!video.videoUrl || !["ready", "published"].includes(video.status)) {
      return res.status(404).json({ message: "Video is not available yet." });
    }

    if (!video.publicId && !(video.visibility === "public" && video.hlsUrl)) {
      return res.status(500).json({ message: "Video publicId missing — cannot generate stream URL." });
    }

    let streamUrl;

    if (video.visibility === "public" && video.hlsUrl) {
      streamUrl = video.hlsUrl;
    } else if (video.visibility === "public") {
      // Generate the HLS Adaptive Bitrate URL natively via Cloudinary SDK
      ensureCloudinaryConfig();
      streamUrl = cloudinary.url(video.publicId, {
        resource_type: "video",
        streaming_profile: "auto",
        format: "m3u8",
        secure: true
      });
    } else {
      const profile = video.publishing?.adaptive && video.publishing.adaptive.state !== "ready"
        ? "auto:maxres_480p" : "auto";
      streamUrl = buildSignedUrl(video.publicId, profile);
    }

    incrementViewCount(videoId, userId);
    return res.redirect(302, streamUrl);

  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    next(err);
  }
};
