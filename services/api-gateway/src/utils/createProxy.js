import { createProxyMiddleware } from "http-proxy-middleware";

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
