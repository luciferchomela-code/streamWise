const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/;

export const isAllowedBrowserOrigin = (origin) => {
  const configured = (process.env.ALLOWED_FRONTEND_ORIGINS || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  return configured.includes(origin) ||
    (process.env.NODE_ENV !== "production" && localOrigin.test(origin));
};
