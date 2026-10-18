import { Router } from "express";
import jwt from "jsonwebtoken";
import { isAuth } from "../middleware/isAuth.js";
import { createProxy } from "../utils/createProxy.js";

const router = Router();
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:5001";

const proxy = createProxy(AUTH_SERVICE_URL, "Auth service");

const getJwtSecret = () => {
  const secret = process.env.JWT_SEC;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SEC must be configured");
    }
    return "dev_jwt_secret_streamwise_key_123";
  }
  return secret;
};

/**
 * Revokes the access-token JTI in Redis during logout.
 * Uses jwt.verify (not decode) so only cryptographically valid tokens
 * can write a key into the Redis denylist — prevents key-injection attacks.
 */
const revokeAccessTokenOnLogout = async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (token && req.app?.locals?.redisClient) {
    try {
      const decoded = jwt.verify(token, getJwtSecret(), {
        algorithms: ["HS256"],
        issuer: "streamwise-auth",
        audience: "streamwise-api",
        // Allow already-expired tokens on logout so users can still sign out cleanly
        ignoreExpiration: true,
      });
      if (decoded?.jti) {
        // TTL: remaining lifetime or 15 min cap — whichever is less, but always at least 1s
        const nowSec = Math.floor(Date.now() / 1000);
        const remaining = decoded.exp ? Math.max(1, decoded.exp - nowSec) : 15 * 60;
        const ttl = Math.min(remaining, 15 * 60);
        await req.app.locals.redisClient.set(`revoked_jti:${decoded.jti}`, "true", { EX: ttl });
      }
    } catch (_) {
      // Non-blocking: if token is malformed/unsigned, skip — there's nothing valid to revoke
    }
  }
  next();
};

router.post("/login", proxy);
router.post("/refresh", proxy);
router.post("/logout", revokeAccessTokenOnLogout, proxy);

router.get("/me", isAuth, proxy);

export default router;