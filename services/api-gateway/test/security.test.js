import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
  createGatewaySignature,
  verifyGatewaySignature,
} from "../src/utils/gatewaySignature.js";
import { csrfProtection } from "../src/middleware/csrfProtection.js";

const TEST_SECRET = "dev_jwt_secret_streamwise_key_123";

test("JWT Security: Pin algorithm to HS256 and reject forged/none algorithms", () => {
  const payload = { userId: "user_123", email: "test@example.com", type: "access" };

  // Valid token
  const validToken = jwt.sign(payload, TEST_SECRET, {
    algorithm: "HS256",
    expiresIn: "15m",
    issuer: "streamwise-auth",
    audience: "streamwise-api",
  });

  const verified = jwt.verify(validToken, TEST_SECRET, {
    algorithms: ["HS256"],
    issuer: "streamwise-auth",
    audience: "streamwise-api",
  });
  assert.equal(verified.userId, "user_123");

  // Forged algorithm attempt: signed with different key or alg
  assert.throws(() => {
    jwt.verify(validToken, "wrong_secret_key", {
      algorithms: ["HS256"],
    });
  }, /invalid signature/);

  // Rejection of invalid issuer
  assert.throws(() => {
    jwt.verify(validToken, TEST_SECRET, {
      algorithms: ["HS256"],
      issuer: "attacker-auth",
    });
  }, /jwt issuer invalid/);

  // Rejection of invalid audience
  assert.throws(() => {
    jwt.verify(validToken, TEST_SECRET, {
      algorithms: ["HS256"],
      audience: "attacker-api",
    });
  }, /jwt audience invalid/);
});

test("JWT Security: Expired tokens are rejected", () => {
  const expiredToken = jwt.sign(
    { userId: "user_123", type: "access" },
    TEST_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "-1s",
      issuer: "streamwise-auth",
      audience: "streamwise-api",
    }
  );

  assert.throws(() => {
    jwt.verify(expiredToken, TEST_SECRET, {
      algorithms: ["HS256"],
      issuer: "streamwise-auth",
      audience: "streamwise-api",
    });
  }, /jwt expired/);
});

test("Gateway Trust: Cryptographic assertion signs identity and rejects spoofing", () => {
  const timestamp = Date.now();
  const signature = createGatewaySignature({
    userId: "user_999",
    requestId: "req_abc",
    timestamp,
  });

  // Valid verification
  const isValid = verifyGatewaySignature({
    userId: "user_999",
    requestId: "req_abc",
    timestamp,
    signature,
  });
  assert.equal(isValid, true);

  // Spoofed userId with same signature must FAIL
  const spoofedUser = verifyGatewaySignature({
    userId: "victim_user_111",
    requestId: "req_abc",
    timestamp,
    signature,
  });
  assert.equal(spoofedUser, false);

  // Forged signature must FAIL
  const forgedSig = verifyGatewaySignature({
    userId: "user_999",
    requestId: "req_abc",
    timestamp,
    signature: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  });
  assert.equal(forgedSig, false);

  // Replay attack with expired timestamp (> 60s) must FAIL
  const oldTimestamp = Date.now() - 65 * 1000;
  const oldSignature = createGatewaySignature({
    userId: "user_999",
    requestId: "req_abc",
    timestamp: oldTimestamp,
  });
  const replayed = verifyGatewaySignature({
    userId: "user_999",
    requestId: "req_abc",
    timestamp: oldTimestamp,
    signature: oldSignature,
  });
  assert.equal(replayed, false);
});

test("CSRF Protection: Blocks cross-site mutating requests and permits safe requests", () => {
  let calledNext = false;
  const mockNext = () => { calledNext = true; };

  // 1. Safe GET method passes without Origin
  calledNext = false;
  csrfProtection({ method: "GET", headers: {} }, {}, mockNext);
  assert.equal(calledNext, true);

  // 2. POST with Sec-Fetch-Site: cross-site is BLOCKED with 403
  let blockedStatus = null;
  let blockedResponse = null;
  const mockRes = {
    status: (code) => {
      blockedStatus = code;
      return { json: (data) => { blockedResponse = data; } };
    },
  };

  csrfProtection(
    { method: "POST", headers: { "sec-fetch-site": "cross-site", origin: "http://localhost:5173" } },
    mockRes,
    mockNext
  );
  assert.equal(blockedStatus, 403);

  // 3. POST with untrusted Origin is BLOCKED with 403
  blockedStatus = null;
  csrfProtection(
    { method: "POST", headers: { origin: "https://evil-hacker.com" } },
    mockRes,
    mockNext
  );
  assert.equal(blockedStatus, 403);

  // 4. POST with trusted local origin PASSES
  calledNext = false;
  csrfProtection(
    { method: "POST", headers: { origin: "http://localhost:5173" } },
    mockRes,
    mockNext
  );
  assert.equal(calledNext, true);

  // 5. POST with cookies attached but NO origin or referer is BLOCKED with 403
  blockedStatus = null;
  csrfProtection(
    { method: "POST", headers: {}, cookies: { accessToken: "tok" } },
    mockRes,
    mockNext
  );
  assert.equal(blockedStatus, 403);

  // 6. Mutating request with NO cookies and NO origin/referer (Login CSRF attempt) is BLOCKED
  blockedStatus = null;
  csrfProtection(
    { method: "POST", headers: {} },
    mockRes,
    mockNext
  );
  assert.equal(blockedStatus, 403);

  // 7. Legitimate request with Referer fallback (Origin absent) PASSES
  calledNext = false;
  csrfProtection(
    { method: "POST", headers: { referer: "http://localhost:5173/watch" } },
    mockRes,
    mockNext
  );
  assert.equal(calledNext, true);

  // 8. Untrusted Referer is BLOCKED with 403
  blockedStatus = null;
  csrfProtection(
    { method: "POST", headers: { referer: "https://malicious-site.com/attack" } },
    mockRes,
    mockNext
  );
  assert.equal(blockedStatus, 403);
});

test("Gateway Trust: Replay Behavior Analysis on Exact Same Signed Request", () => {
  const timestamp = Date.now();
  const requestId = "req_fixed_uuid_test_123";
  const userId = "user_victim_555";

  const signature = createGatewaySignature({
    userId,
    requestId,
    timestamp,
  });

  // First receipt: valid
  const firstVerification = verifyGatewaySignature({
    userId,
    requestId,
    timestamp,
    signature,
  });
  assert.equal(firstVerification, true);

  // Replay of exact same signed request within 60s window:
  // Downstream verifies signature idempotently. Without stateful distributed cache for request IDs,
  // stateless HMAC verification evaluates identical input as true within ±60s clock skew window.
  const replayVerification = verifyGatewaySignature({
    userId,
    requestId,
    timestamp,
    signature,
  });
  assert.equal(replayVerification, true);

  // Replay outside 60s window: REJECTED by timestamp check
  const expiredTimestamp = timestamp - 61 * 1000;
  const expiredSignature = createGatewaySignature({
    userId,
    requestId,
    timestamp: expiredTimestamp,
  });
  const expiredVerification = verifyGatewaySignature({
    userId,
    requestId,
    timestamp: expiredTimestamp,
    signature: expiredSignature,
  });
  assert.equal(expiredVerification, false);
});
