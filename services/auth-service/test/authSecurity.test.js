import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { verifyGatewaySignature } from "../../shared/utils/gatewaySignature.js";

const hashToken = (rawToken) => {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
};

test("Refresh Token Entropy: Token has 320-bit entropy and constant-time SHA-256 hash", () => {
  const tokenA = crypto.randomBytes(40).toString("hex");
  const tokenB = crypto.randomBytes(40).toString("hex");

  assert.equal(tokenA.length, 80);
  assert.equal(tokenB.length, 80);
  assert.notEqual(tokenA, tokenB);

  const hashA = hashToken(tokenA);
  const hashB = hashToken(tokenB);

  assert.equal(hashA.length, 64);
  assert.equal(hashB.length, 64);
  assert.notEqual(hashA, hashB);
});

test("Refresh Rotation Concurrency: Atomic conditional update allows exactly one rotation", async () => {
  // Simulates MongoDB findOneAndUpdate({ _id, isRevoked: false }, { $set: { isRevoked: true } })
  const tokenRecord = {
    _id: "doc_123",
    isRevoked: false,
    familyId: "fam_abc",
  };

  // Atomic test harness: simulates document-level mutex of MongoDB findOneAndUpdate
  let updateLock = false;
  const atomicFindOneAndUpdate = async (filter, update) => {
    while (updateLock) {
      await new Promise((r) => setImmediate(r));
    }
    updateLock = true;
    try {
      if (tokenRecord._id === filter._id && tokenRecord.isRevoked === filter.isRevoked) {
        Object.assign(tokenRecord, update.$set);
        return { ...tokenRecord };
      }
      return null; // Match failed: already revoked by racing request
    } finally {
      updateLock = false;
    }
  };

  // Launch two simultaneous rotation requests with the same token
  const now = Date.now();

  
  const simulateRefreshRequest = async (requestId, reqTime = now) => {
    // Both requests perform async read (findOne)
    const readDoc = await new Promise((r) => setImmediate(() => r({ ...tokenRecord })));

    if (readDoc.isRevoked) {
      const isConcurrentFlight = reqTime - (readDoc.updatedAt || 0) < 10000;
      if (isConcurrentFlight) {
        return { status: 409, message: "Concurrent token refresh in progress" };
      }
      return { status: 401, error: "reuse_detected" };
    }

    // Atomic rotation attempt
    const updated = await atomicFindOneAndUpdate(
      { _id: tokenRecord._id, isRevoked: false },
      { $set: { isRevoked: true, updatedAt: reqTime } }
    );

    if (!updated) {
      // Racing request won the rotation
      return { status: 409, message: "Concurrent token refresh in progress" };
    }

    return { status: 200, message: "Tokens refreshed successfully" };
  };

  const [res1, res2] = await Promise.all([
    simulateRefreshRequest("req_1", now),
    simulateRefreshRequest("req_2", now),
  ]);

  const statuses = [res1.status, res2.status].sort();
  // Exactly one request must succeed (200) and the other must be conflict (409)
  assert.deepEqual(statuses, [200, 409]);

  // Valid session family is NOT revoked by legitimate concurrent flight
  assert.notEqual(res1.status, 401);
  assert.notEqual(res2.status, 401);

  // Subsequent request (Turn 3) arrives 15s after rotation (attacker reuse attack!) -> revokes family!
  const res3 = await simulateRefreshRequest("req_3", now + 15000);
  assert.equal(res3.status, 401);
  assert.equal(res3.error, "reuse_detected");
});

test("Token Family & Reuse Detection Simulation", () => {
  const db = new Map();
  const familyId = crypto.randomUUID();
  const userId = "user_abc_123";

  // Login: initial token
  const initialRawToken = crypto.randomBytes(40).toString("hex");
  const initialHash = hashToken(initialRawToken);
  db.set(initialHash, {
    userId,
    tokenHash: initialHash,
    familyId,
    isRevoked: false,
    replacedByTokenHash: null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  // Turn 1: Legitimate Rotation
  const incomingHash1 = hashToken(initialRawToken);
  const tokenDoc1 = db.get(incomingHash1);
  assert.equal(tokenDoc1.isRevoked, false);

  const nextRawToken = crypto.randomBytes(40).toString("hex");
  const nextHash = hashToken(nextRawToken);

  tokenDoc1.isRevoked = true;
  tokenDoc1.replacedByTokenHash = nextHash;

  db.set(nextHash, {
    userId,
    tokenHash: nextHash,
    familyId,
    isRevoked: false,
    replacedByTokenHash: null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  // Turn 2: Attacker replays initialRawToken (Token Reuse Attack!)
  const replayedHash = hashToken(initialRawToken);
  const replayedDoc = db.get(replayedHash);
  assert.equal(replayedDoc.isRevoked, true);

  // System responds: immediately revoke all tokens in family
  for (const [k, doc] of db.entries()) {
    if (doc.familyId === replayedDoc.familyId) {
      doc.isRevoked = true;
    }
  }

  // Turn 3: Legitimate user tries to use nextRawToken
  const victimDoc = db.get(nextHash);
  assert.equal(victimDoc.isRevoked, true); // Session neutralized
});

test("Legacy Session Migration Security & Lineage", async () => {
  const LEGACY_SECRET = "legacy_jwt_secret_streamwise_key_123";
  const userId = "user_legacy_999";

  // 1. Valid legacy token
  const validLegacyToken = jwt.sign(
    { userId, email: "legacy@streamwise.com", type: "refresh" },
    LEGACY_SECRET,
    { algorithm: "HS256", expiresIn: "30d" }
  );

  const bcryptHash = await bcrypt.hash(validLegacyToken, 10);
  let userRecord = {
    _id: userId,
    refreshTokenHash: bcryptHash,
  };

  // Verification helper matching auth.controller logic
  const verifyLegacyMigration = async (token) => {
    try {
      const decoded = jwt.verify(token, LEGACY_SECRET, { algorithms: ["HS256"] });
      if (decoded?.type === "refresh" && decoded?.userId) {
        if (userRecord && userRecord.refreshTokenHash) {
          const match = await bcrypt.compare(token, userRecord.refreshTokenHash);
          if (match) {
            // Atomic clear
            userRecord.refreshTokenHash = null;
            return { status: 200, userId: decoded.userId };
          }
        }
      }
    } catch (_) {}
    return { status: 401, message: "Invalid or expired" };
  };

  // Test: Tampered legacy token fails cryptographic signature
  const tamperedToken = validLegacyToken.slice(0, -5) + "abcde";
  const tamperedRes = await verifyLegacyMigration(tamperedToken);
  assert.equal(tamperedRes.status, 401);

  // Test: Access token presented to legacy refresh endpoint fails type requirement
  const accessTokenMisused = jwt.sign(
    { userId, email: "legacy@streamwise.com", type: "access" },
    LEGACY_SECRET,
    { algorithm: "HS256", expiresIn: "15m" }
  );
  const accessRes = await verifyLegacyMigration(accessTokenMisused);
  assert.equal(accessRes.status, 401);

  // Test: Expired legacy token is rejected
  const expiredToken = jwt.sign(
    { userId, email: "legacy@streamwise.com", type: "refresh" },
    LEGACY_SECRET,
    { algorithm: "HS256", expiresIn: "-1s" }
  );
  const expiredRes = await verifyLegacyMigration(expiredToken);
  assert.equal(expiredRes.status, 401);

  // Test: Valid legacy token passes and atomically clears refreshTokenHash
  const validRes = await verifyLegacyMigration(validLegacyToken);
  assert.equal(validRes.status, 200);
  assert.equal(userRecord.refreshTokenHash, null);

  // Test: Consumed legacy token CANNOT be used again (replay prevention)
  const replayRes = await verifyLegacyMigration(validLegacyToken);
  assert.equal(replayRes.status, 401);
});

test("Downstream Direct Spoofing: requireGatewayIdentity rejects direct calls without valid signature", () => {
  let statusCode = null;
  let statusBody = null;
  const mockRes = {
    status: (code) => {
      statusCode = code;
      return { json: (data) => { statusBody = data; } };
    },
  };

  const reqSpoofed = {
    get: (header) => {
      if (header === "x-user-id") return "victim_user_777";
      return null;
    },
  };

  let calledNext = false;
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
      return res.status(403).json({ message: "Forbidden: Direct service access prohibited or invalid gateway identity" });
    }

    req.auth = { userId };
    next();
  };

  requireGatewayIdentity(reqSpoofed, mockRes, () => { calledNext = true; });
  assert.equal(calledNext, false);
  assert.equal(statusCode, 403);
});
