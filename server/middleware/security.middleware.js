const { logger } = require('../utils/logger');
const { parseAllowedOrigins, isOriginAllowed } = require('../utils/originUtils');

const securityMiddleware = (req, res, next) => {
  // 1. Remove X-Powered-By header (defense in depth — helmet also does this)
  res.removeHeader('X-Powered-By');
  
  // 2. Set X-Content-Type-Options — prevents MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // 3. Set X-Frame-Options — prevents clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // 4. Set X-XSS-Protection — disabled (deprecated, can cause issues in IE)
  res.setHeader('X-XSS-Protection', '0');
  
  // 5. Set Referrer-Policy — controls referrer header leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 6. Set Permissions-Policy — restrict browser features (expanded)
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  // 7. Cross-Origin headers for resource isolation
  // Allow OAuth popup flows (Google) to communicate via postMessage.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  
  // 8. Strict-Transport-Security (HSTS) — force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // 9. Cache-Control for auth, chat, notification & private endpoints — prevent caching of sensitive data
  if (
    req.path.startsWith('/api/auth') ||
    req.path.startsWith('/api/chat') ||
    req.path.startsWith('/api/notifications') ||
    req.path.includes('/my-listings') ||
    req.path.includes('/saved')
  ) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // 10. Request size guard — reject extremely large payloads early
  //     Allow larger payloads for image upload endpoints (multer enforces per-file limits)
  const contentLength = parseInt(req.headers['content-length'], 10);
  const isUploadRoute = req.path.includes('/upload-image') || req.path.includes('/upload');
  const maxPayload = isUploadRoute ? 70 * 1024 * 1024 : 10 * 1024 * 1024; // 70 MB for uploads, 10 MB otherwise
  if (contentLength > maxPayload) {
    logger.securityLog('oversized_request', { ip: req.ip, path: req.path, reason: `content-length: ${contentLength}` });
    return res.status(413).json({ success: false, message: 'Request entity too large' });
  }

  // 11. Block suspicious user-agents (basic bot filtering)
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const blockedPatterns = ['sqlmap', 'nikto', 'dirbuster', 'nessus', 'openvas', 'masscan'];
  if (blockedPatterns.some((p) => ua.includes(p))) {
    logger.securityLog('bot_blocked', { ip: req.ip, path: req.path, userAgent: ua, reason: 'suspicious_user_agent' });
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  // 12. Block path traversal attempts
  if (req.path.includes('..') || req.path.toLowerCase().includes('%2e%2e')) {
    logger.securityLog('path_traversal', { ip: req.ip, path: req.path, reason: 'directory_traversal_attempt' });
    return res.status(400).json({ success: false, message: 'Invalid path' });
  }
  
  // 13. Log security-related headers (dev only)
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Security headers set for request', {
      path: req.path,
      method: req.method,
    });
  }
  
  // 14. CSRF origin validation for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const allowedOrigins = parseAllowedOrigins(process.env.CLIENT_URL);

    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const userAgent = String(req.headers['user-agent'] || '').toLowerCase();
    const hasCookieHeader = typeof req.headers.cookie === 'string' && req.headers.cookie.length > 0;
    const hasFetchMetadata = typeof req.headers['sec-fetch-site'] === 'string';
    const apiClientPatterns = ['thunder client', 'postman', 'insomnia', 'curl/', 'httpie', 'paw/'];
    const mobileAppPatterns = ['react-native', 'expo/', 'okhttp/', 'dart', 'android', 'cfnetwork'];
    const isLikelyApiClient = !hasFetchMetadata && apiClientPatterns.some((pattern) => userAgent.includes(pattern));
    const isLikelyMobileApp = !hasFetchMetadata && mobileAppPatterns.some((pattern) => userAgent.includes(pattern));
    const isLikelyNonBrowserClient = isLikelyApiClient || isLikelyMobileApp || (!hasCookieHeader && !hasFetchMetadata);

    if (origin) {
      if (!isOriginAllowed(origin, allowedOrigins)) {
        // Allow LAN/localhost origins in development (mobile dev builds)
        let devBypass = false;
        if (process.env.NODE_ENV !== 'production') {
          try {
            const parsed = new URL(origin);
            const host = parsed.hostname;
            if (host === 'localhost' || host === '127.0.0.1' || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host)) {
              devBypass = true;
            }
          } catch (_) {}
        }

        if (isLikelyNonBrowserClient || devBypass) {
          return next();
        }

        logger.securityLog('csrf_blocked', { ip: req.ip, path: req.path, method: req.method, reason: `unexpected_origin: ${origin}` });
        return res.status(403).json({
          success: false,
          message: 'Origin not allowed',
        });
      }
    } else if (referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        if (!isOriginAllowed(refererOrigin, allowedOrigins)) {
          if (isLikelyNonBrowserClient) {
            return next();
          }

          logger.securityLog('csrf_blocked', { ip: req.ip, path: req.path, method: req.method, reason: `unexpected_referer: ${refererOrigin}` });
          return res.status(403).json({
            success: false,
            message: 'Origin not allowed',
          });
        }
      } catch (_) {
        if (isLikelyNonBrowserClient) {
          return next();
        }

        // Malformed referer — block on mutation routes (potential CSRF bypass)
        logger.securityLog('csrf_blocked', { ip: req.ip, path: req.path, method: req.method, reason: 'malformed_referer' });
        return res.status(403).json({
          success: false,
          message: 'Origin not allowed',
        });
      }
    } else {
      if (isLikelyNonBrowserClient) {
        return next();
      }

      // No Origin AND no Referer on browser/cookie mutation request — reject.
      logger.securityLog('csrf_blocked', { ip: req.ip, path: req.path, method: req.method, reason: 'no_origin_no_referer' });
      return res.status(403).json({
        success: false,
        message: 'Origin not allowed',
      });
    }
  }
  
  next();
};

module.exports = securityMiddleware;