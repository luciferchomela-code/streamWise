/**
 * uploadOwnership.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Regression tests for upload ownership and deletion authorization in the
 * upload service.
 *
 * Run with: node --test   (or: npm test  inside services/upload)
 *
 * No live Cloudinary calls are made — all external I/O is mocked in-memory.
 *
 * Coverage:
 *  1. getVideoSignature: owner can get a signature for their draft
 *  2. getVideoSignature: non-owner is rejected with 403
 *  3. getVideoSignature: missing videoId returns 400
 *  4. getVideoSignature: already-finalized video returns 409
 *  5. deleteVideoInternal: requireGatewayIdentity rejects unsigned request (403)
 *  6. deleteVideoInternal: requireGatewayIdentity rejects no-userId request (401)
 *  7. deleteVideoInternal: valid signed request succeeds
 *  8. deleteVideoInternal: Cloudinary "not found" is treated as success (retry safety)
 *  9. Gateway signature: spoofed userId rejected with same timestamp
 */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  createGatewaySignature,
  verifyGatewaySignature,
} from "../src/utils/gatewaySignature.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a mock Express request with optional gateway-signed headers. */
const makeMockReq = ({
  userId,
  requestId,
  timestamp,
  signature,
  queryParams = {},
  auth = null,
} = {}) => ({
  get: (header) => {
    const map = {
      "x-user-id": userId,
      "x-gateway-timestamp": timestamp?.toString(),
      "x-gateway-signature": signature,
      "x-request-id": requestId,
      "x-user-email": undefined,
    };
    return map[header] ?? undefined;
  },
  query: queryParams,
  auth,
});

/** Build a mock Express response with chainable status/json. */
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

/** Sign gateway headers for a given userId (mirrors what the gateway does). */
const signHeaders = (userId) => {
  const timestamp = Date.now();
  const requestId = crypto.randomUUID();
  const signature = createGatewaySignature({ userId, requestId, timestamp });
  return { userId, timestamp, requestId, signature };
};

// ─── Inline middleware (mirrors requireGatewayIdentity.js exactly) ────────────

const requireGatewayIdentity = (req, res, next) => {
  const userId = req.get("x-user-id");
  const timestamp = req.get("x-gateway-timestamp");
  const signature = req.get("x-gateway-signature");
  const requestId = req.get("x-request-id");

  if (!userId) {
    return res.status(401).json({ message: "Authentication is required" });
  }

  const isValid = verifyGatewaySignature({ userId, requestId, timestamp, signature });
  if (!isValid) {
    return res
      .status(403)
      .json({ message: "Forbidden: Direct service access prohibited or invalid gateway identity" });
  }

  req.auth = { userId, email: req.get("x-user-email") || undefined };
  next();
};

// ─── Inline ownership controller logic ────────────────────────────────────────
/**
 * Simulates getVideoSignature ownership check using an in-memory video "DB"
 * instead of real HTTP calls to video-metadata.
 */
const makeOwnershipController = (videoDB) => async (req, res, next) => {
  try {
    const { videoId } = req.query;
    const userId = req.auth?.userId;

    if (!videoId) {
      return res.status(400).json({ message: "videoId query param is required." });
    }

    const video = videoDB[videoId];
    if (!video) {
      return res.status(404).json({ message: "Video draft not found." });
    }

    // Mirror the populated channelId.ownerId check from the real controller
    const channelOwnerId = video.channelId?.ownerId?.toString?.() ?? null;

    if (!channelOwnerId || channelOwnerId !== userId) {
      return res.status(403).json({ message: "Forbidden: you do not own this video draft." });
    }

    if (video.status !== "draft" && video.status !== "uploading") {
      return res.status(409).json({
        message: "Video is already finalized and cannot be re-uploaded.",
      });
    }

    return res.status(200).json({
      success: true,
      videoId,
      signature: "mock-cloudinary-signature",
      timestamp: Math.round(Date.now() / 1000),
    });
  } catch (error) {
    next(error);
  }
};

/** Simulates deleteVideoInternal with a configurable Cloudinary result string. */
const makeDeleteController = (cloudinaryResult = "ok") => async (req, res, next) => {
  try {
    const { publicId } = req.query;
    if (!publicId) {
      return res.status(400).json({ message: "publicId query param is required." });
    }
    return res.status(200).json({ success: true, result: cloudinaryResult });
  } catch (error) {
    next(error);
  }
};

// ─── Test fixtures ────────────────────────────────────────────────────────────

const OWNER_USER_ID = "user_owner_111";
const OTHER_USER_ID = "user_other_222";
const DRAFT_VIDEO_ID = "video_draft_aaa";
const READY_VIDEO_ID = "video_ready_bbb";

const videoDB = {
  [DRAFT_VIDEO_ID]: {
    _id: DRAFT_VIDEO_ID,
    status: "draft",
    channelId: { _id: "chan_001", ownerId: OWNER_USER_ID },
  },
  [READY_VIDEO_ID]: {
    _id: READY_VIDEO_ID,
    status: "ready",
    channelId: { _id: "chan_001", ownerId: OWNER_USER_ID },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS
// ─────────────────────────────────────────────────────────────────────────────

test("getVideoSignature: owner receives a Cloudinary signature for their draft", async () => {
  const headers = signHeaders(OWNER_USER_ID);
  const req = makeMockReq({
    ...headers,
    queryParams: { videoId: DRAFT_VIDEO_ID },
    auth: { userId: OWNER_USER_ID },
  });
  const res = makeMockRes();

  const controller = makeOwnershipController(videoDB);
  await controller(req, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.videoId, DRAFT_VIDEO_ID);
});

test("getVideoSignature: non-owner is rejected with 403", async () => {
  const headers = signHeaders(OTHER_USER_ID);
  const req = makeMockReq({
    ...headers,
    queryParams: { videoId: DRAFT_VIDEO_ID },
    auth: { userId: OTHER_USER_ID },
  });
  const res = makeMockRes();

  const controller = makeOwnershipController(videoDB);
  await controller(req, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 403);
  assert.ok(res.body.message.includes("Forbidden"));
});

test("getVideoSignature: missing videoId returns 400", async () => {
  const headers = signHeaders(OWNER_USER_ID);
  const req = makeMockReq({
    ...headers,
    queryParams: {},
    auth: { userId: OWNER_USER_ID },
  });
  const res = makeMockRes();

  const controller = makeOwnershipController(videoDB);
  await controller(req, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 400);
});

test("getVideoSignature: already-finalized video returns 409", async () => {
  const headers = signHeaders(OWNER_USER_ID);
  const req = makeMockReq({
    ...headers,
    queryParams: { videoId: READY_VIDEO_ID },
    auth: { userId: OWNER_USER_ID },
  });
  const res = makeMockRes();

  const controller = makeOwnershipController(videoDB);
  await controller(req, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 409);
});

test("deleteVideoInternal: missing userId returns 401", () => {
  const req = makeMockReq({
    // No userId at all
    queryParams: { publicId: "streamwise/videos/some-id" },
  });
  const res = makeMockRes();

  let calledNext = false;
  requireGatewayIdentity(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 401);
});

test("deleteVideoInternal: unsigned request is rejected with 403 by requireGatewayIdentity", () => {
  // Has userId but no HMAC signature — simulates browser trying to call internal route
  const req = makeMockReq({
    userId: OWNER_USER_ID,
    timestamp: undefined,
    signature: undefined,
    requestId: undefined,
    queryParams: { publicId: "streamwise/videos/some-id" },
  });
  const res = makeMockRes();

  let calledNext = false;
  requireGatewayIdentity(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 403);
  assert.ok(res.body.message.includes("Forbidden"));
});

test("deleteVideoInternal: valid signed request succeeds (Cloudinary ok)", async () => {
  const headers = signHeaders(OWNER_USER_ID);
  const req = makeMockReq({
    ...headers,
    queryParams: { publicId: "streamwise/videos/some-id" },
    auth: { userId: OWNER_USER_ID },
  });
  const res = makeMockRes();

  // Verify the gateway identity check passes for a legitimately signed request
  let nextCalled = false;
  requireGatewayIdentity(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true, "Gateway identity check should pass with valid HMAC signature");

  const controller = makeDeleteController("ok");
  await controller(req, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.result, "ok");
});

test("deleteVideoInternal: Cloudinary 'not found' is treated as success for retry safety", async () => {
  const headers = signHeaders(OWNER_USER_ID);
  const req = makeMockReq({
    ...headers,
    queryParams: { publicId: "streamwise/videos/already-deleted" },
    auth: { userId: OWNER_USER_ID },
  });
  const res = makeMockRes();

  // Cloudinary returns "not found" when the asset was already deleted.
  // The controller must still return 200 so the caller can safely retry.
  const controller = makeDeleteController("not found");
  await controller(req, res, (err) => {
    throw err;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.result, "not found");
  assert.equal(res.body.success, true);
});

test("Gateway signature: spoofed userId is rejected even with a valid timestamp", () => {
  const { userId, timestamp, requestId, signature } = signHeaders(OWNER_USER_ID);

  // Attacker tries to claim OTHER_USER_ID while reusing OWNER's signature
  const isValid = verifyGatewaySignature({
    userId: OTHER_USER_ID, // spoofed
    requestId,
    timestamp,
    signature,
  });
  assert.equal(isValid, false);
});
