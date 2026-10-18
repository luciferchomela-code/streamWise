import { createProxyMiddleware } from "http-proxy-middleware";
import { createGatewaySignature } from "./gatewaySignature.js";

export const createProxy = (targetUrl, serviceName = "Unknown service") => {
  return createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: (path, req) => req.originalUrl,
    on: {
      proxyReq: (proxyReq, req) => {
        // Forward Correlation ID
        if (req.requestId) {
          proxyReq.setHeader("x-request-id", req.requestId);
        }

        // Forward Authenticated User Info
        if (req.auth) {
          proxyReq.setHeader("x-user-id", req.auth.userId);
          if (req.auth.email) {
            proxyReq.setHeader("x-user-email", req.auth.email);
          }
        }

        // Always sign gateway request to prove origin and prevent direct port spoofing
        const timestamp = Date.now();
        const signature = createGatewaySignature({
          userId: req.auth?.userId || "",
          requestId: req.requestId,
          timestamp,
        });
        proxyReq.setHeader("x-gateway-signature", signature);
        proxyReq.setHeader("x-gateway-timestamp", timestamp.toString());
      },
      proxyRes: (proxyRes) => {
        // Prevent downstream services from overriding gateway CORS
        delete proxyRes.headers["access-control-allow-origin"];
        delete proxyRes.headers["access-control-allow-methods"];
        delete proxyRes.headers["access-control-allow-credentials"];
        delete proxyRes.headers["access-control-allow-headers"];
      },
      error: (err, req, res) => {
        console.error(
          `[API-Gateway] ${serviceName} proxy error [${req.requestId || "unknown"}]:`,
          err.message
        );
        res.status(502).json({
          message: `${serviceName} unavailable`,
          requestId: req.requestId,
        });
      },
    },
  });
};
