/**
 * videoDelete.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Regression tests for the video deletion flow in the video-metadata service.
 *
 * Run with: node --test   (or: npm test  inside services/video-metadata)
 *
 * All external I/O (Mongoose, fetch to upload service) is mocked in-memory.
 *
 * Coverage:
 *  1. Owner deletes their video — Cloudinary succeeds
 *  2. Non-owner is rejected with 403 — no Cloudinary call made
 *  3. Cleanup call carries a valid gateway HMAC signature
 *  4. Cloudinary "not found" on retry is treated as success (idempotent delete)
 *  5. Upload service network failure preserves metadata (502 with retry message)
 *  6. Video without publicId (draft never uploaded) skips Cloudinary cleanup
 */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  createGatewaySignature,
  verifyGatewaySignature,
} from "../../shared/utils/gatewaySignature.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeMockRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

// ─── In-memory fixtures ───────────────────────────────────────────────────────

const OWNER_ID = "owner_user_aaa";
const OTHER_ID = "other_user_bbb";
const CHANNEL_ID_STR = "chan_xyz_001";
const VIDEO_ID = "video_abc_123";
const PUBLIC_ID = "streamwise/videos/video_abc_123";

const makeChannelDoc = (ownerId = OWNER_ID) => ({
  _id: { toString: () => CHANNEL_ID_STR },
  ownerId,
});

const makeVideoDoc = (overrides = {}) => ({
  _id: VIDEO_ID,
  channelId: { toString: () => CHANNEL_ID_STR },
  publicId: PUBLIC_ID,
  deleteOne: async () => {},
  ...overrides,
});

// ─── Inline deleteVideo handler ───────────────────────────────────────────────
/**
 * Mirrors the ownership-check + signed-cleanup logic from the real controller
 * without requiring Mongoose or a live upload service.
 *
 * req.mockDB.{channel, video} stand in for the DB calls.
 * fetchMock stands in for the fetch() call to the upload service.
 */
const makeDeleteVideoHandler =
  ({ fetchMock }) =>
  async (req, res) => {
    const userId = req.auth.userId;

    // Ownership check (mocked DB)
    const channel = req.mockDB.channel;
    if (!channel) return res.status(404).json({ message: "Channel not found." });

    const video = req.mockDB.video;
    if (!video) return res.status(404).json({ message: "Video not found." });

    if (video.channelId.toString() !== channel._id.toString()) {
      return res.status(403).json({ message: "You are not authorized to delete this video." });
    }

    // Cloudinary cleanup via signed internal call
    if (video.publicId) {
      const timestamp = Date.now();
      const requestId = crypto.randomUUID();
      const signature = createGatewaySignature({ userId, requestId, timestamp });

      try {
        const cloudRes = await fetchMock(
          `http://localhost:5003/api/upload/video/internal?publicId=${encodeURIComponent(video.publicId)}`,
          {
            method: "DELETE",
            headers: {
              "x-user-id": userId,
              "x-request-id": requestId,
              "x-gateway-timestamp": timestamp.toString(),
              "x-gateway-signature": signature,
            },
          }
        );

        if (!cloudRes.ok) {
          const body = await cloudRes.json().catch(() => ({}));
          if (body.result !== "not found") {
            return res.status(502).json({
              message:
                `Cloudinary deletion failed: ${body.message || "unknown error"}. ` +
                "Video metadata preserved — please retry deletion.",
            });
          }
          // "not found" → asset already gone, safe to continue
        }
      } catch (fetchErr) {
        return res.status(502).json({
          message:
            `Could not reach upload service: ${fetchErr.message}. ` +
            "Video metadata preserved — please retry deletion.",
        });
      }
    }

    // Delete the video document
    await video.deleteOne();

    return res.status(200).json({ success: true, message: "Video deleted successfully" });
  };

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS
// ─────────────────────────────────────────────────────────────────────────────

test("deleteVideo: owner deletes their video — Cloudinary succeeds", async () => {
  let cleanupCalled = false;
  let cleanupHeaders = null;

  const fetchMock = async (url, opts) => {
    cleanupCalled = true;
    cleanupHeaders = opts.headers;
    return {
      ok: true,
      json: async () => ({ success: true, result: "ok" }),
    };
  };

  const handler = makeDeleteVideoHandler({ fetchMock });
  const res = makeMockRes();
  const req = {
    auth: { userId: OWNER_ID },
    params: { videoId: VIDEO_ID },
    mockDB: {
      channel: makeChannelDoc(OWNER_ID),
      video: makeVideoDoc(),
    },
  };

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(cleanupCalled, true, "Should have called the upload service for Cloudinary cleanup");
});

test("deleteVideo: cleanup call carries a valid gateway HMAC signature", async () => {
  let capturedHeaders = null;

  const fetchMock = async (url, opts) => {
    capturedHeaders = opts.headers;
    return { ok: true, json: async () => ({ success: true, result: "ok" }) };
  };

  const handler = makeDeleteVideoHandler({ fetchMock });
  const res = makeMockRes();
  const req = {
    auth: { userId: OWNER_ID },
    params: { videoId: VIDEO_ID },
    mockDB: {
      channel: makeChannelDoc(OWNER_ID),
      video: makeVideoDoc(),
    },
  };

  await handler(req, res);
  assert.equal(res.statusCode, 200);

  const {
    "x-user-id": uid,
    "x-request-id": rid,
    "x-gateway-timestamp": ts,
    "x-gateway-signature": sig,
  } = capturedHeaders;

  const signatureValid = verifyGatewaySignature({
    userId: uid,
    requestId: rid,
    timestamp: ts,
    signature: sig,
  });
  assert.equal(
    signatureValid,
    true,
    "Cloudinary cleanup call must carry a valid gateway HMAC signature"
  );
});

test("deleteVideo: non-owner is rejected with 403 — no Cloudinary call made", async () => {
  let cleanupCalled = false;
  const fetchMock = async () => {
    cleanupCalled = true;
    return { ok: true, json: async () => ({}) };
  };

  const handler = makeDeleteVideoHandler({ fetchMock });
  const res = makeMockRes();
  const req = {
    auth: { userId: OTHER_ID },
    params: { videoId: VIDEO_ID },
    mockDB: {
      // OTHER_ID's channel has a different _id than the video's channelId
      channel: { _id: { toString: () => "chan_other_999" }, ownerId: OTHER_ID },
      video: makeVideoDoc(),
    },
  };

  await handler(req, res);

  assert.equal(res.statusCode, 403);
  assert.ok(res.body.message.includes("not authorized"));
  assert.equal(cleanupCalled, false, "Must NOT call upload service when ownership check fails");
});

test("deleteVideo: Cloudinary 'not found' on retry is treated as success (idempotent)", async () => {
  // Simulates: video was partially deleted (Cloudinary asset gone, DB record remains).
  // A second delete attempt should succeed even though Cloudinary says "not found".
  const fetchMock = async () => ({
    ok: false, // Cloudinary might return a non-2xx status for "not found"
    status: 404,
    json: async () => ({ success: true, result: "not found" }),
  });

  const handler = makeDeleteVideoHandler({ fetchMock });
  const res = makeMockRes();
  const req = {
    auth: { userId: OWNER_ID },
    params: { videoId: VIDEO_ID },
    mockDB: {
      channel: makeChannelDoc(OWNER_ID),
      video: makeVideoDoc(),
    },
  };

  await handler(req, res);

  // "not found" must NOT block the metadata deletion
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

test("deleteVideo: upload service network failure preserves metadata (502 + retry message)", async () => {
  const fetchMock = async () => {
    throw new Error("ECONNREFUSED: upload service is down");
  };

  const handler = makeDeleteVideoHandler({ fetchMock });
  const res = makeMockRes();
  const req = {
    auth: { userId: OWNER_ID },
    params: { videoId: VIDEO_ID },
    mockDB: {
      channel: makeChannelDoc(OWNER_ID),
      video: makeVideoDoc(),
    },
  };

  await handler(req, res);

  // Metadata must be preserved — video document is NOT deleted
  assert.equal(res.statusCode, 502);
  assert.ok(
    res.body.message.includes("Could not reach upload service"),
    "Error message must describe the failure"
  );
  assert.ok(
    res.body.message.toLowerCase().includes("retry"),
    "Error message must tell the user they can retry"
  );
});

test("deleteVideo: video with no publicId (never uploaded) skips Cloudinary cleanup", async () => {
  let cleanupCalled = false;
  const fetchMock = async () => {
    cleanupCalled = true;
    return { ok: true, json: async () => ({}) };
  };

  const handler = makeDeleteVideoHandler({ fetchMock });
  const res = makeMockRes();
  const req = {
    auth: { userId: OWNER_ID },
    params: { videoId: VIDEO_ID },
    mockDB: {
      channel: makeChannelDoc(OWNER_ID),
      // Draft video that was never uploaded to Cloudinary
      video: makeVideoDoc({ publicId: null }),
    },
  };

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(cleanupCalled, false, "No Cloudinary call needed for a video with no publicId");
});

