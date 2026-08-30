import jwt from "jsonwebtoken";

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decodedValue = jwt.verify(token, process.env.JWT_SEC);
      if (decodedValue && decodedValue.type === "access" && decodedValue.userId) {
        req.auth = {
          userId: decodedValue.userId,
          email: decodedValue.email,
        };
      }
    } catch (_) {
      // Ignore token errors for optional auth routes
    }
  }
  next();
};