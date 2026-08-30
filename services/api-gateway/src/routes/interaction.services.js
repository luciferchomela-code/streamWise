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
        `[API-Gateway] Interaction service proxy error [${req.requestId}]:`,
        err.message
      );
      res.status(502).json({
        message: "Interaction service unavailable",
        requestId: req.requestId,
      });
    },
  },
};

const proxy = createProxyMiddleware(proxyOptions);

// Public / Guest Allowed (Optional Auth so guest views register)
router.post("/:videoId/view", optionalAuth, proxy);

// Protected Interactions (Require Login)
router.post("/:videoId/like", isAuth, proxy);
router.post("/:videoId/dislike", isAuth, proxy);
router.post("/:videoId/comment", isAuth, proxy);
router.delete("/comment/:commentId", isAuth, proxy);

export default router;