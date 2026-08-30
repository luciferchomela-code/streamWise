import { Router } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { isAuth } from "../middleware/isAuth.js";
import { optionalAuth } from "../middleware/optionalAuth.js";

const router = Router();

// Ensure environment variable points to channel/video service correctly
const CHANNEL_SERVICE_URL =
  process.env.CHANNEL_SERVICE_URL ||
  process.env.VIDEO_METADATA_SERVICE_URL ||
  "http://localhost:5002";

const proxyOptions = {
  target: CHANNEL_SERVICE_URL,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req) => {
      // Re-stream JSON body if express.json() parsed it
      fixRequestBody(proxyReq, req);

      if (req.requestId) {
        proxyReq.setHeader("x-request-id", req.requestId);
      }
      if (req.auth) {
        proxyReq.setHeader("x-user-id", req.auth.userId);
        if (req.auth.email) {
          proxyReq.setHeader("x-user-email", req.auth.email);
        }
      }
    },
    error: (err, req, res) => {
      console.error(
        `[API-Gateway] Channel service proxy error [${req.requestId}]:`,
        err.message
      );
      res.status(502).json({
        message: "Channel service unavailable",
        requestId: req.requestId,
      });
    },
  },
};

const proxy = createProxyMiddleware(proxyOptions);

// Protected Channel Actions (Root paths)
router.post("/", isAuth, proxy);
router.put("/", isAuth, proxy);
router.delete("/", isAuth, proxy);

// Protected Channel Interactions
router.post("/:channelId/subscribe", isAuth, proxy);
router.delete("/:channelId/unsubscribe", isAuth, proxy);

// Public Channel Fetching 
router.get("/:channelId", optionalAuth, proxy);

export default router;