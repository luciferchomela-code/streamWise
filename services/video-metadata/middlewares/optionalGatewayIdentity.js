import { verifyGatewaySignature } from "../../shared/utils/gatewaySignature.js";

export const optionalGatewayIdentity = (req, res, next) => {
  const userId = req.get("x-user-id");
  const timestamp = req.get("x-gateway-timestamp");
  const signature = req.get("x-gateway-signature");
  const requestId = req.get("x-request-id");

  if (userId) {
    const isValid = verifyGatewaySignature({ userId, requestId, timestamp, signature });
    if (isValid) {
      req.auth = {
        userId,
        email: req.get("x-user-email") || undefined,
      };
    } else {
      // Discard spoofed or unverified identity on optional routes
      req.auth = null;
    }
  }

  next();
};
