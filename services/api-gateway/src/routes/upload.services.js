import { Router } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { isAuth } from "../middleware/isAuth.js";

const router = Router();

const UPLOAD_SERVICE_URL = process.env.UPLOAD_SERVICE_URL || "http://localhost:5003";

// Middleware to inject auth context into downstream request headers
const injectAuthHeaders = (req, _res, next) => {
  if (req.auth) {
    req.headers["x-user-id"] = req.auth.userId;
    req.headers["x-user-email"] = req.auth.email;
  }
  next();
};

const proxyOptions = {
  target: UPLOAD_SERVICE_URL,
  changeOrigin: true,
  // Don't buffer the body — let the proxy stream multipart uploads
  selfHandleResponse: false,
  on: {
    proxyReq: (proxyReq, req, res) => {
      // Re-stream JSON body if express.json() parsed it
      fixRequestBody(proxyReq, req); 
      // Pass request ID downstream
      if (req.requestId) {
        proxyReq.setHeader("x-request-id", req.requestId);
      }
    },
    error: (err, req, res) => {
      console.error(
        `[API-Gateway] Upload service proxy error [${req.requestId}]:`,
        err.message
      );
      res.status(502).json({
        message: "Upload service unavailable",
        requestId: req.requestId,
      });
    },
  },
};

const proxy = createProxyMiddleware(proxyOptions);

// // ─── Upload Routes (all protected) ───────────────────────────────────────────

// // POST /api/upload/video
// router.post("/video", isAuth, proxy);

// // POST /api/upload/thumbnail
// router.post("/thumbnail", isAuth, proxy);

export default router;
