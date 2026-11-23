import { isAuth } from "./src/middleware/isAuth.js";
import { optionalAuth } from "./src/middleware/optionalAuth.js";
import { createProxy } from "./src/utils/createProxy.js";
import { attachCommunity } from "./src/utils/communitySocket.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import { randomUUID } from "crypto";

import authRoutes from "./src/routes/auth.services.js";
import videoRoutes from "./src/routes/video.services.js";
import channelRoutes from "./src/routes/channel.services.js";
import interactionRoutes from "./src/routes/interaction.services.js";
import uploadRoutes from "./src/routes/upload.services.js";
import streamRoutes from "./src/routes/stream.services.js";
import { parseCookies } from "./src/middleware/parseCookies.js";
import { csrfProtection } from "./src/middleware/csrfProtection.js";
import { isAllowedBrowserOrigin } from "./src/utils/browserOrigins.js";
import { trackGatewayRequests } from "./src/utils/requestMetrics.js";

dotenv.config();

if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SEC) {
    throw new Error("FATAL: JWT_SEC must be configured in environment variables");
  }
  if (!process.env.GATEWAY_SECRET) {
    throw new Error("FATAL: GATEWAY_SECRET must be configured in environment variables");
  }
}

const app = express();
const trustedProxies = (process.env.TRUSTED_PROXY_ADDRESSES || "").split(",").map((value) => value.trim()).filter(Boolean);
if (trustedProxies.length) app.set("trust proxy", trustedProxies);
const PORT = process.env.PORT || 5000;

app.use(parseCookies);

const USE_REDIS = process.env.REDIS_URL || process.env.USE_REDIS === 'true';
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

if (USE_REDIS) {
  redisClient.on("error", (err) => console.error("Redis Client Error", err.message));
  redisClient.connect().catch(() => console.warn("Redis not connected, skipping caching."));
}

app.locals.redisClient = redisClient;

app.use(helmet());
app.use(
  cors({
    origin: function(origin, callback) {
      if (!origin || isAllowedBrowserOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

let rateLimitStore;
if (process.env.REDIS_URL || process.env.USE_REDIS === 'true') {
  rateLimitStore = new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  });
}

app.use(
  rateLimit({
    store: rateLimitStore, // Defaults to MemoryStore if undefined
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
  })
);

app.use((req, res, next) => {
  const requestId = randomUUID();
  req.requestId = requestId;
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);

  // Strip all identity and trust headers that clients must not control
  delete req.headers["x-user-id"];
  delete req.headers["x-user-email"];
  delete req.headers["x-gateway-signature"];
  delete req.headers["x-gateway-timestamp"];
  delete req.headers["x-guest-viewer"];
  delete req.headers["x-guest-viewer-signature"];

  next();
});
app.use(trackGatewayRequests(redisClient, USE_REDIS));

// JSON parsing logic removed. 
// API Gateway should not parse the body so it can be streamed directly to downstream microservices.

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "api-gateway", timestamp: new Date().toISOString(), requestId: req.requestId });
});

// Enforce CSRF Origin / Referer validation on state-changing requests
const featureProxy = createProxy(process.env.VIDEO_METADATA_SERVICE_URL || "http://localhost:5002", "Video metadata service");
app.post("/api/playback-health/events", (req, res, next) => {
  if (!isAllowedBrowserOrigin(req.get("origin"))) return res.sendStatus(403);
  delete req.headers.cookie;
  delete req.headers.authorization;
  next();
}, featureProxy);
app.use(csrfProtection);

const recommendations = createProxy(process.env.RECOMMENDATION_SERVICE_URL || "http://localhost:8000", "Recommendations");
app.post("/api/recommendations/impressions", optionalAuth, recommendations);
app.get("/api/recommendations", optionalAuth, recommendations);

app.use("/api/auth", authRoutes);
app.use(["/api/community", "/api/studio", "/api/playlists", "/api/moderation"], isAuth, featureProxy);
app.get("/api/playback-health", isAuth, featureProxy);
app.get("/api/playback-health/sessions/:id", isAuth, featureProxy);
app.use("/api/captions", (req, res, next) =>
  (["GET", "HEAD"].includes(req.method) ? optionalAuth : isAuth)(req, res, next), featureProxy);
app.use("/api/videos", videoRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/interactions", interactionRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/stream", streamRoutes);   // GET /api/stream/:videoId

const partyProxy = createProxy(process.env.VIDEO_METADATA_SERVICE_URL || "http://localhost:5002", "WatchParty service");
app.use("/api/parties", optionalAuth, partyProxy);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found", requestId: req.requestId });
});

app.use((error, req, res, next) => {
  console.error(`[Error][${req.requestId}]`, error);
  res.status(500).json({
    message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
    requestId: req.requestId,
  });
});

const server = app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

attachCommunity(server, redisClient, app);

const handleShutdown = async (signal) => {
  console.log(`Received ${signal}. Closing server...`);
  await redisClient.quit();
  server.close(() => process.exit(0));
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
