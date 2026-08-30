import { Router } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { isAuth } from "../middleware/isAuth.js";

const router = Router();
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:5001";

const proxyOptions = {
  target: AUTH_SERVICE_URL,
  changeOrigin: true,
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
      console.error(`[API-Gateway] Auth service error [${req.requestId}]:`, err.message);
      res.status(502).json({
        message: "Auth service unavailable",
        requestId: req.requestId,
      });
    },
  },
};

const injectAuthHeaders = (req, _res, next) => {
  if (req.auth) {
    req.headers["x-user-id"] = req.auth.userId;
    req.headers["x-user-email"] = req.auth.email;
  }
  next();
};

router.post("/login", createProxyMiddleware(proxyOptions));
router.post("/refresh", createProxyMiddleware(proxyOptions));
router.post("/logout", createProxyMiddleware(proxyOptions));

router.get("/me", isAuth, injectAuthHeaders, createProxyMiddleware(proxyOptions));

export default router;