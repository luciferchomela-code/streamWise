export const requireGatewayIdentity = (req, res, next) => {
  const userId = req.get("x-user-id");
  if (!userId) {
    return res.status(401).json({ message: "Authentication is required" });
  }

  req.auth = {
    userId,
    email: req.get("x-user-email") || undefined,
  };

  next();
};
