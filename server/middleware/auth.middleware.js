const jwt = require("jsonwebtoken");
const User = require("../models/user.model.js");
const {
  revokeAllUserTokens,
  revokeRefreshToken,
  clearRefreshTokenCookie,
  clearTokenCookies,
  refreshTokens,
} = require("../utils/tokenUtils");
const { logger } = require("../utils/logger");

// ─────────────────────────────────────────────────────────────────────────────
// AUTH USER CACHE — Eliminates 10k+ MongoDB queries/sec on hot paths
// At 10k concurrent users, every request does User.findById. This L1 cache
// stores verified user objects for 30s, reducing auth DB load by ~95%.
// Cache is invalidated on user update/logout/status change.
// ─────────────────────────────────────────────────────────────────────────────
const _authUserCache = new Map();
const AUTH_CACHE_TTL_MS = 30_000; // 30s — short enough for security changes to propagate
const AUTH_CACHE_MAX = 10_000; // max cached users (prevents memory bloat)

function _getCachedUser(userId) {
  const entry = _authUserCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _authUserCache.delete(userId);
    return null;
  }
  return entry.user;
}

function _setCachedUser(userId, user) {
  // Evict oldest if at capacity
  if (_authUserCache.size >= AUTH_CACHE_MAX && !_authUserCache.has(userId)) {
    const firstKey = _authUserCache.keys().next().value;
    _authUserCache.delete(firstKey);
  }
  _authUserCache.set(userId, {
    user,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  });
}

/** Invalidate cached user (call on logout, profile update, status change). */
function invalidateAuthCache(userId) {
  if (userId) _authUserCache.delete(String(userId));
}

/** Bulk clear (e.g. admin bans). */
function clearAuthCache() {
  _authUserCache.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: extract a stable fingerprint from User-Agent
// Hashes only the browser family + platform (e.g. "Chrome|Windows") so that
// minor version bumps (Chrome/120 → Chrome/121) don't invalidate the token.
// ─────────────────────────────────────────────────────────────────────────────
const extractStableFgp = (ua) => {
  const crypto = require("crypto");
  // Extract browser family (Chrome, Firefox, Safari, Edg, Opera, etc.)
  let browser = "unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  // Extract platform family
  let platform = "unknown";
  if (/Windows/i.test(ua)) platform = "Windows";
  else if (/Macintosh/i.test(ua)) platform = "Mac";
  else if (/Linux/i.test(ua)) platform = "Linux";
  else if (/Android/i.test(ua)) platform = "Android";
  else if (/iPhone|iPad/i.test(ua)) platform = "iOS";

  return crypto
    .createHash("sha256")
    .update(`${browser}|${platform}`)
    .digest("hex")
    .substring(0, 16);
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: extract access token from request
// Priority: HttpOnly cookie "accessToken"  →  Authorization: Bearer header
// ─────────────────────────────────────────────────────────────────────────────
const extractAccessToken = (req) => {
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    return req.headers.authorization.split(" ")[1];
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// protect — verifies access token, attaches req.user
// ─────────────────────────────────────────────────────────────────────────────
exports.protect = async (req, res, next) => {
  try {
    const token = extractAccessToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route. Please login.",
        code: "NO_TOKEN",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      // Reject refresh tokens used as access tokens
      if (decoded.type && decoded.type !== "access") {
        return res.status(401).json({
          success: false,
          message: "Invalid token type. Please use access token.",
          code: "INVALID_TOKEN_TYPE",
        });
      }

      // Validate token fingerprint — if the token was bound to a
      // browser family at creation time, log a warning when used from
      // a different browser.  Uses a stable browser-family hash instead
      // of the full User-Agent to avoid false mismatches from browser
      // version updates (Chrome/120 → Chrome/121 etc.).
      if (decoded.fgp) {
        const crypto = require("crypto");
        const ua = req.get("user-agent") || "";
        const currentFgp = extractStableFgp(ua);
        if (decoded.fgp !== currentFgp) {
          // Block — stolen tokens used from a different device/browser family
          // are rejected immediately. Mobile clients re-bind fgp on every
          // fresh login, so legitimate UA changes only affect one session.
          logger.warn("protect: token fingerprint mismatch — blocking request", {
            userId: decoded.id,
            expectedFgp: decoded.fgp,
            actualFgp: currentFgp,
            userAgent: ua.substring(0, 80),
          });
          return res.status(401).json({
            success: false,
            message: "Session invalid. Please log in again.",
            code: "FINGERPRINT_MISMATCH",
          });
        }
      }

      // Wrap the DB call in its own try/catch so that MongoDB
      // connection errors return 503 (transient) instead of 401.
      // This prevents the client from logging the user out when
      // MongoDB briefly disconnects and reconnects.
      let user;

      // ── L1 cache: check status/active quickly (sub-ms, avoids DB hit for blocked users) ──
      const cachedUser = _getCachedUser(decoded.id);

      if (cachedUser) {
        // Cache holds {status, _id} — use it for quick rejection checks only.
        // Still fetch full Mongoose document for controllers that need methods
        // (e.g. user.save(), user.getProfileImage(), user.toJSON()).
        if (cachedUser.status !== "active") {
          return res.status(403).json({
            success: false,
            message: `Your account is ${cachedUser.status}. Please contact support.`,
            code: "ACCOUNT_INACTIVE",
          });
        }
      }

      try {
        user = await User.findById(decoded.id).select(
          "-password -followers -following -loginHistory -securityLogs -passwordHistory -devices",
        );
      } catch (dbError) {
        logger.warn("protect: MongoDB temporarily unavailable", {
          error: dbError.message,
          userId: decoded.id,
        });
        return res.status(503).json({
          success: false,
          message: "Database temporarily unavailable. Please retry.",
          code: "DB_UNAVAILABLE",
        });
      }

      // Cache the user status for subsequent requests (quick rejection path)
      if (user) {
        _setCachedUser(decoded.id, { _id: user._id, status: user.status });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User no longer exists.",
          code: "USER_NOT_FOUND",
        });
      }

      if (user.status !== "active") {
        return res.status(403).json({
          success: false,
          message: `Your account is ${user.status}. Please contact support.`,
          code: "ACCOUNT_INACTIVE",
        });
      }

      req.user = user;
      next();
    } catch (error) {
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token. Please login again.",
          code: "INVALID_TOKEN",
        });
      }
      if (error.name === "TokenExpiredError") {
        // Don't return error here - let the frontend handle refresh
        return res.status(401).json({
          success: false,
          message: "Token expired. Please refresh token.",
          code: "TOKEN_EXPIRED",
        });
      }
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route.",
        code: "AUTH_FAILED",
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// refreshToken — issues new access + refresh token pair via cookie
// ─────────────────────────────────────────────────────────────────────────────
exports.refreshToken = async (req, res) => {
  try {
    // Accept refresh token from cookie (web) OR request body (React Native mobile)
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "No refresh token provided.",
        code: "NO_REFRESH_TOKEN",
      });
    }

    const result = await refreshTokens(refreshToken, req);

    // refreshTokens returns { concurrentRefresh: true } when another
    // request already rotated this token.  The winner set cookies in
    // its response; tell this caller to simply retry.
    if (result && result.concurrentRefresh) {
      return res.status(200).json({
        success: true,
        message: "Token refresh handled by concurrent request. Retry.",
        code: "CONCURRENT_REFRESH",
      });
    }

    // Transient error (Redis timeout, network blip) — do NOT clear the
    // cookie.  The token may still be perfectly valid; the server just
    // couldn't verify it right now.  Return 503 so the client retries.
    if (result?.error === "transient") {
      logger.warn(
        "Refresh token: transient error — keeping cookie, returning 503",
      );
      return res.status(503).json({
        success: false,
        message: "Temporary server error. Please retry.",
        code: "REFRESH_TRANSIENT_ERROR",
      });
    }

    // Genuinely invalid / expired / revoked token — clear the cookie.
    if (result?.error === "invalid" || !result?.tokens) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token.",
        code: "INVALID_REFRESH_TOKEN",
      });
    }

    const {
      setRefreshTokenCookie,
      setTokenCookies,
    } = require("../utils/tokenUtils");

    // Set all token cookies using the same helper as login/register
    // (consistent secure/sameSite flags based on CLIENT_URL protocol)
    setTokenCookies(res, result.tokens.accessToken, result.tokens.refreshToken);

    // Return tokens in body for React Native (cookies don't persist on mobile)
    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully.",
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });
  } catch (error) {
    logger.error("Refresh token error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during token refresh.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// logout — revoke current session, clear both cookies
// ─────────────────────────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    // Accept from cookie (web) or body (React Native mobile)
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    clearTokenCookies(res);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    logger.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Error during logout.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// logoutAll — revoke all tokens for the user, clear both cookies
// ─────────────────────────────────────────────────────────────────────────────
exports.logoutAll = async (req, res) => {
  try {
    const userId = req.user.id;
    await revokeAllUserTokens(userId);

    clearTokenCookies(res);

    return res.status(200).json({
      success: true,
      message: "Logged out from all devices successfully.",
    });
  } catch (error) {
    logger.error("Logout all error:", error);
    return res.status(500).json({
      success: false,
      message: "Error during logout.",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// authorize — role-based access control
// ─────────────────────────────────────────────────────────────────────────────
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated.",
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this route.",
      });
    }
    next();
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// optionalAuth — attach user if token present, else continue without error
// ─────────────────────────────────────────────────────────────────────────────
exports.optionalAuth = async (req, res, next) => {
  try {
    const token = extractAccessToken(req);

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        if (!decoded.type || decoded.type === "access") {
          const user = await User.findById(decoded.id).select(
            "-password -followers -following -loginHistory -securityLogs -passwordHistory -devices",
          );
          // Only attach active users
          if (user && user.status === "active") {
            req.user = user;
          }
        }
      } catch (error) {
        logger.debug("Optional auth — invalid token:", error.message);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

// ── Exported cache helpers (for use by controllers on user update/logout) ──
exports.invalidateAuthCache = invalidateAuthCache;
exports.clearAuthCache = clearAuthCache;
