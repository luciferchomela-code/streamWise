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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Redis Client
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));
redisClient.connect().catch(console.error);

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(
  rateLimit({
    store: new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    }),
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
  })
);

// Correlation ID & Header Sanitization
app.use((req, res, next) => {
  const requestId = randomUUID();
  req.requestId = requestId;
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  
  delete req.headers["x-user-id"];
  delete req.headers["x-user-email"];

  next();
});

// JSON parsing logic removed. 
// API Gateway should not parse the body so it can be streamed directly to downstream microservices.

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "api-gateway", timestamp: new Date().toISOString(), requestId: req.requestId });
});

app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/interactions", interactionRoutes);
app.use("/api/upload", uploadRoutes);

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

const handleShutdown = async (signal) => {
  console.log(`Received ${signal}. Closing server...`);
  await redisClient.quit();
  server.close(() => process.exit(0));
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));