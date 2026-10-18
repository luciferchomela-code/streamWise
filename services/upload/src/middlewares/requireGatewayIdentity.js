import { verifyGatewaySignature } from "../utils/gatewaySignature.js";

export const requireGatewayIdentity = (req, res, next) => {
  const userId = req.get("x-user-id");
  const timestamp = req.get("x-gateway-timestamp");
  const signature = req.get("x-gateway-signature");
  const requestId = req.get("x-request-id");

  if (!userId) {
    return res.status(401).json({ message: "Authentication is required" });
  }

  const isValid = verifyGatewaySignature({ userId, requestId, timestamp, signature });
  if (!isValid) {
    return res.status(403).json({ message: "Forbidden: Direct service access prohibited or invalid gateway identity" });
  }

  req.auth = {
    userId,
    email: req.get("x-user-email") || undefined,
  };

  next();
};
