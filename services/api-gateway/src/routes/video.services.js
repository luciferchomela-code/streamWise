import { Router } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { isAuth } from "../middleware/isAuth.js";
import { optionalAuth } from "../middleware/optionalAuth.js";

const router = Router();

const VIDEO_METADATA_SERVICE_URL =
  process.env.VIDEO_METADATA_SERVICE_URL || "http://localhost:5002";

const proxyOptions = {
  target: VIDEO_METADATA_SERVICE_URL,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req) => {
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
        `[API-Gateway] Video metadata service proxy error [${req.requestId}]:`,
        err.message
      );
      res.status(502).json({
        message: "Video metadata service unavailable",
        requestId: req.requestId,
      });
    },
  },
};

const proxy = createProxyMiddleware(proxyOptions);

// ─── Video Routes ─────────────────────────────────────────────────────────────

// Static & Collection Routes (Public)
router.get("/trending", optionalAuth, proxy);
router.get("/latest", optionalAuth, proxy);
router.get("/search", optionalAuth, proxy);
router.get("/channel/:channelId", optionalAuth, proxy);

// Protected Actions
router.post("/draft", isAuth, proxy);
router.delete("/:videoId", isAuth, proxy);

// Param-matched Single Resource (Public / Optional Auth)
router.get("/:videoId", optionalAuth, proxy);

export default router;