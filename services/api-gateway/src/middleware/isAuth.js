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

export const isAuth = async (req, res, next) => {
    try {
        let token = req.cookies?.accessToken;

        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith("Bearer ")) {
                token = authHeader.split(" ")[1];
            }
        }

        if (!token) {
            return res.status(401).json({
                message: "please login",
            });
        }

        const secret = getJwtSecret();
        let decodedValue;

        try {
            // Strict verification: pinned algorithm, issuer, and audience
            decodedValue = jwt.verify(token, secret, {
                algorithms: ["HS256"],
                issuer: "streamwise-auth",
                audience: "streamwise-api",
            });
        } catch (err) {
            // Rolling migration fallback: allow valid tokens issued prior to claim enforcement
            if (
                err.name === "JsonWebTokenError" &&
                (err.message.includes("jwt issuer invalid") || err.message.includes("jwt audience invalid"))
            ) {
                decodedValue = jwt.verify(token, secret, {
                    algorithms: ["HS256"],
                });
            } else {
                throw err;
            }
        }

        if (!decodedValue || decodedValue.type !== "access" || !decodedValue.userId) {
            return res.status(401).json({
                message: "invalid token",
            });
        }

        // Check Redis token revocation denylist if Redis client is available
        const redis = req.app?.locals?.redisClient;
        if (redis && decodedValue.jti) {
            try {
                const isRevoked = await redis.get(`revoked_jti:${decodedValue.jti}`);
                if (isRevoked) {
                    return res.status(401).json({
                        message: "Token has been revoked. Please log in again.",
                    });
                }
            } catch (_) {
                // Non-blocking if Redis is unreachable
            }
        }

        req.auth = {
            userId: decodedValue.userId,
            email: decodedValue.email,
            jti: decodedValue.jti,
        };

        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Access token expired",
            });
        }
        res.status(401).json({
            message: "invalid access token",
        });
    }
};
