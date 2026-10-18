import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import axios from "axios";
import asyncHandler from "../middlewares/tryCatch.js";
import User from "../../../shared/models/user.model.js";
import RefreshToken from "../../../shared/models/refreshToken.model.js";
import { getOAuth2Client } from "../../../shared/config/googleConfig.js";

const JWT_ISSUER = "streamwise-auth";
const JWT_AUDIENCE = "streamwise-api";

const getJwtSecret = () => {
  const secret = process.env.JWT_SEC;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SEC environment variable must be configured in production");
    }
    return "dev_jwt_secret_streamwise_key_123";
  }
  return secret;
};

const isProduction = process.env.NODE_ENV === "production";

export const getBaseCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
});

export const getAccessCookieOptions = () => ({
  ...getBaseCookieOptions(),
  path: "/",
  maxAge: 15 * 60 * 1000, // 15 minutes
});

export const getRefreshCookieOptions = () => ({
  ...getBaseCookieOptions(),
  path: "/api/auth",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
});

const hashToken = (rawToken) => {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
};

/**
 * Issues short-lived access token with standard claims (iss, aud, jti, sub)
 */
const issueAccessToken = (user) => {
  const jti = crypto.randomUUID();
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      type: "access",
    },
    getJwtSecret(),
    {
      algorithm: "HS256",
      expiresIn: "15m",
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      jwtid: jti,
    }
  );
};

/**
 * Creates cryptographically secure opaque refresh token in token family
 */
const createRefreshTokenSession = async (userId, existingFamilyId = null) => {
  const rawRefreshToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = hashToken(rawRefreshToken);
  const familyId = existingFamilyId || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId,
    tokenHash,
    familyId,
    expiresAt,
  });

  return { rawRefreshToken, familyId };
};

export const loginUser = asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({
      message: "Authorization code is required",
    });
  }

  const client = getOAuth2Client();
  let tokens;
  try {
    const googleRes = await client.getToken(code);
    tokens = googleRes.tokens;
  } catch (err) {
    console.error("Google Token Exchange Error:", err?.response?.data || err.message);
    return res.status(400).json({
      message:
        "Google OAuth exchange failed: " +
        (err?.response?.data?.error_description || err?.response?.data?.error || err.message),
    });
  }

  if (!tokens?.access_token) {
    return res.status(401).json({ message: "Google authentication failed: missing access token" });
  }

  // fetch user info from google
  const userRes = await axios.get("https://www.googleapis.com/oauth2/v1/userinfo", {
    params: {
      alt: "json",
      access_token: tokens.access_token,
    },
  });

  const { email, name, picture } = userRes.data;

  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      name,
      email,
      image: picture,
    });
  }

  const accessToken = issueAccessToken(user);
  const { rawRefreshToken } = await createRefreshTokenSession(user._id);

  res.cookie("accessToken", accessToken, getAccessCookieOptions());
  res.cookie("refreshToken", rawRefreshToken, getRefreshCookieOptions());

  res.status(200).json({
    message: "logged in successfully",
    accessToken,
    refreshToken: rawRefreshToken,
    user,
  });
});

export const myProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.auth.userId);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.status(200).json({ user });
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingToken) {
    return res.status(401).json({ message: "Refresh token is required" });
  }

  const incomingHash = hashToken(incomingToken);

  // 1. Check if token exists in RefreshToken collection
  const tokenDoc = await RefreshToken.findOne({ tokenHash: incomingHash });

  if (!tokenDoc) {
    // 1b. Backward-compatibility fallback for legacy sessions during migration
    let legacyUser = null;
    try {
      const legacySecret = process.env.JWT_REFRESH_SEC || getJwtSecret();
      const decoded = jwt.verify(incomingToken, legacySecret, {
        algorithms: ["HS256"],
      });
      if (decoded?.type === "refresh" && decoded?.userId) {
        const candidate = await User.findById(decoded.userId).select("+refreshTokenHash");
        if (candidate?.refreshTokenHash) {
          const match = await bcrypt.compare(incomingToken, candidate.refreshTokenHash);
          if (match) {
            // ATOMIC: use findOneAndUpdate so only one concurrent request wins the migration.
            // If refreshTokenHash was already cleared (by a racing request), migrated is null.
            const migrated = await User.findOneAndUpdate(
              { _id: candidate._id, refreshTokenHash: { $exists: true, $ne: null } },
              { $set: { refreshTokenHash: null } },
              { new: false }
            );
            if (migrated) legacyUser = candidate;
          }
        }
      }
    } catch (_) {
      // not a valid legacy jwt or expired/tampered
    }

    if (!legacyUser) {
      return res.status(401).json({ message: "Refresh token is invalid or has expired" });
    }

    const newAccessToken = issueAccessToken(legacyUser);
    const { rawRefreshToken } = await createRefreshTokenSession(legacyUser._id);

    res.cookie("accessToken", newAccessToken, getAccessCookieOptions());
    res.cookie("refreshToken", rawRefreshToken, getRefreshCookieOptions());

    return res.status(200).json({
      message: "Tokens refreshed successfully",
      accessToken: newAccessToken,
      refreshToken: rawRefreshToken,
    });
  }

  // 2. Check Expiration
  if (tokenDoc.expiresAt < new Date()) {
    return res.status(401).json({ message: "Refresh token expired" });
  }

  // 3. REUSE DETECTION: If token already marked revoked/rotated was presented
  if (tokenDoc.isRevoked) {
    const rotatedAt = tokenDoc.updatedAt ? new Date(tokenDoc.updatedAt).getTime() : 0;
    const isConcurrentFlight = Date.now() - rotatedAt < 10000; // 10s burst window for in-flight requests

    if (isConcurrentFlight) {
      // Legitimate concurrent request racing with recent rotation.
      // Do NOT issue tokens (no session extension), but do NOT destroy family.
      return res.status(409).json({
        message: "Concurrent token refresh in progress. Please use the newly issued session.",
      });
    }

    // Reuse attack: rotated token reused after in-flight window.
    console.warn(`[Security Alert] Refresh token reuse detected for family ${tokenDoc.familyId}! Revoking entire family.`);
    await RefreshToken.updateMany(
      { familyId: tokenDoc.familyId },
      { $set: { isRevoked: true } }
    );

    res.clearCookie("accessToken", { ...getBaseCookieOptions(), path: "/" });
    res.clearCookie("refreshToken", { ...getBaseCookieOptions(), path: "/api/auth" });

    return res.status(401).json({
      message: "Security alert: Compromised session detected. All sessions in this family have been revoked.",
    });
  }

  // 4. Fetch User
  const user = await User.findById(tokenDoc.userId);
  if (!user) {
    return res.status(401).json({ message: "User no longer exists" });
  }

  // 5. ATOMIC ROTATION
  const nextRawToken = crypto.randomBytes(40).toString("hex");
  const nextHash = hashToken(nextRawToken);

  const updatedOldToken = await RefreshToken.findOneAndUpdate(
    { _id: tokenDoc._id, isRevoked: false },
    { $set: { isRevoked: true, replacedByTokenHash: nextHash } },
    { new: true }
  );

  if (!updatedOldToken) {
    // Concurrent request already rotated this token
    return res.status(409).json({ message: "Concurrent token refresh in progress" });
  }

  // Create new active token in same family
  await RefreshToken.create({
    userId: user._id,
    tokenHash: nextHash,
    familyId: tokenDoc.familyId,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const nextAccessToken = issueAccessToken(user);

  res.cookie("accessToken", nextAccessToken, getAccessCookieOptions());
  res.cookie("refreshToken", nextRawToken, getRefreshCookieOptions());

  res.status(200).json({
    message: "Tokens refreshed successfully",
    accessToken: nextAccessToken,
    refreshToken: nextRawToken,
  });
});

export const logoutUser = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (incomingToken) {
    try {
      const incomingHash = hashToken(incomingToken);
      const tokenDoc = await RefreshToken.findOne({ tokenHash: incomingHash });
      if (tokenDoc) {
        // Invalidate the token family
        await RefreshToken.updateMany(
          { familyId: tokenDoc.familyId },
          { $set: { isRevoked: true } }
        );
      }
    } catch (_) {
      // Idempotent
    }
  }

  res.clearCookie("accessToken", { ...getBaseCookieOptions(), path: "/" });
  res.clearCookie("refreshToken", { ...getBaseCookieOptions(), path: "/api/auth" });

  res.status(200).json({
    message: "Logged out successfully",
  });
});
