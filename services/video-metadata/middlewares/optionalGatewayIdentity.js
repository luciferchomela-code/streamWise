export const optionalGatewayIdentity = (req, res, next) => {
  const userId = req.get("x-user-id");

  if (userId) {
    req.auth = {
      userId,
      email: req.get("x-user-email") || undefined,
    };
  }

  next();
};
