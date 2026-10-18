import crypto from "crypto";

const getGatewaySecret = () => {
  const secret = process.env.GATEWAY_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("GATEWAY_SECRET environment variable is required in production");
    }
    return "dev_internal_gateway_secret_streamwise_key_8492";
  }
  return secret;
};

/**
 * Creates HMAC signature of identity assertion
 */
export const createGatewaySignature = ({ userId, requestId, timestamp }) => {
  const secret = getGatewaySecret();
  const payload = `${userId || "anonymous"}:${requestId || ""}:${timestamp}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
};

/**
 * Verifies gateway signature with replay protection (max 60 seconds)
 */
export const verifyGatewaySignature = ({ userId, requestId, timestamp, signature }) => {
  if (!timestamp || !signature) return false;
  const now = Date.now();
  const ts = Number(timestamp);
  if (isNaN(ts) || Math.abs(now - ts) > 60 * 1000) {
    return false;
  }

  const expected = createGatewaySignature({ userId, requestId, timestamp: ts });
  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const signatureBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
};
