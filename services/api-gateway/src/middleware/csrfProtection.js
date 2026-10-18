const ALLOWED_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/;

/**
 * Validates Origin/Referer and Sec-Fetch-Site on state-changing requests (POST, PUT, PATCH, DELETE).
 * Protects credentialed cookie requests from cross-site request forgery.
 */
export const csrfProtection = (req, res, next) => {
  const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  // Sec-Fetch-Site check: reject cross-site subrequests/forms
  const secFetchSite = req.headers["sec-fetch-site"];
  if (secFetchSite === "cross-site") {
    return res.status(403).json({
      message: "Cross-site request forbidden by CSRF protection policy",
      requestId: req.requestId,
    });
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Validate Origin header if present
  if (origin) {
    if (!ALLOWED_ORIGIN_REGEX.test(origin)) {
      return res.status(403).json({
        message: "Forbidden: Origin not allowed by CSRF policy",
        requestId: req.requestId,
      });
    }
    return next();
  }

  // Fallback to Referer header if Origin not set
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (!ALLOWED_ORIGIN_REGEX.test(refererUrl.origin)) {
        return res.status(403).json({
          message: "Forbidden: Referer origin not allowed by CSRF policy",
          requestId: req.requestId,
        });
      }
      return next();
    } catch {
      return res.status(403).json({
        message: "Invalid Referer header",
        requestId: req.requestId,
      });
    }
  }

  // If both Origin and Referer are absent on any mutating request, block.
  // This covers login CSRF (no cookies) and anonymous state-change attacks.
  return res.status(403).json({
    message: "Missing Origin or Referer header. Request rejected by CSRF policy.",
    requestId: req.requestId,
  });
};
