/**
 * fetchVideoDoc.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin internal fetch helper: calls video-metadata service to get a video doc.
 * Uses Node 18+ native fetch — no extra dependency needed.
 *
 * Why a separate file?
 *   - Keeps stream.controller.js pure: "given a doc, produce a stream response"
 *   - Easy to swap for a direct DB call if upload-service ever gets Mongoose
 *   - Mockable in tests without touching controller logic
 */

import crypto from "crypto";
import { createGatewaySignature } from "./gatewaySignature.js";

const VIDEO_METADATA_INTERNAL_URL =
  process.env.VIDEO_METADATA_INTERNAL_URL || "http://localhost:5002";

/**
 * Fetches a video document from video-metadata service.
 * @param {string} videoId  - MongoDB ObjectId string
 * @param {string} [userId] - Optional: forwarded so private-video auth works
 * @returns {Promise<object>} The video document
 * @throws  Will throw with .statusCode if video not found / forbidden
 */
export const fetchVideoDoc = async (videoId, userId) => {
  const headers = { "Content-Type": "application/json" };

  // Forward user identity with internal trust signature for private-video access checks
  if (userId) {
    const timestamp = Date.now();
    const requestId = crypto.randomUUID();
    const signature = createGatewaySignature({ userId, requestId, timestamp });
    headers["x-user-id"] = userId;
    headers["x-request-id"] = requestId;
    headers["x-gateway-timestamp"] = timestamp.toString();
    headers["x-gateway-signature"] = signature;
  }

  const res = await fetch(
    `${VIDEO_METADATA_INTERNAL_URL}/api/videos/${videoId}`,
    { headers }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || "Video not found");
    err.statusCode = res.status;
    throw err;
  }

  const { video } = await res.json();
  return video;
};
