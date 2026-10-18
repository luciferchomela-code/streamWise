import jwt from "jsonwebtoken";

const getJwtSecret = () => {
  const secret = process.env.JWT_SEC;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SEC must be configured in environment variables");
    }
    return "dev_jwt_secret_streamwise_key_123";
  }
  return secret;
};

export const optionalAuth = async (req, res, next) => {
  let token = req.cookies?.accessToken;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  if (token) {
    const secret = getJwtSecret();
    try {
      let decodedValue;
      try {
        decodedValue = jwt.verify(token, secret, {
          algorithms: ["HS256"],
          issuer: "streamwise-auth",
          audience: "streamwise-api",
        });
      } catch (err) {
        if (
          err.name === "JsonWebTokenError" &&
          (err.message.includes("jwt issuer invalid") || err.message.includes("jwt audience invalid"))
        ) {
          decodedValue = jwt.verify(token, secret, {
            algorithms: ["HS256"],
          });
        }
      }

      if (decodedValue && decodedValue.type === "access" && decodedValue.userId) {
        const redis = req.app?.locals?.redisClient;
        let isRevoked = false;
        if (redis && decodedValue.jti) {
          try {
            isRevoked = !!(await redis.get(`revoked_jti:${decodedValue.jti}`));
          } catch (_) {}
        }

        if (!isRevoked) {
          req.auth = {
            userId: decodedValue.userId,
            email: decodedValue.email,
            jti: decodedValue.jti,
          };
        }
      }
    } catch (_) {
      // Discard invalid token on optional auth routes
    }
  }

  next();
};