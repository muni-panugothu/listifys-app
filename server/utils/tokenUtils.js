const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const redis = require('../config/redis.js');
const { logger } = require('./logger.js');

// ==================== OTP Masking Utility ====================

/**
 * Mask an OTP for safe logging in any environment.
 * Production: fully redacted → "[REDACTED]"
 * Development: first digit shown, rest masked → "4*****"
 * @param {string} otp
 * @returns {string}
 */
const maskOtp = (otp) => {
  if (!otp) return '[EMPTY]';
  const str = String(otp);
  if (process.env.NODE_ENV === 'production') return '[REDACTED]';
  return str.charAt(0) + '*'.repeat(str.length - 1);
};

/**
 * Generate access token (short-lived)
 * @param {string} userId - User ID
 * @param {Object} req - Express request (optional, for fingerprint)
 * @returns {string} JWT access token
 */
const generateAccessToken = (userId, req = null) => {
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error('JWT_ACCESS_SECRET is required. Never share keys between access and refresh tokens.');
  }
  
  const payload = { 
    id: userId,
    type: 'access',
    jti: crypto.randomBytes(16).toString('hex'),
  };

  // Token fingerprint: bind the token to the client's browser family + platform.
  // Uses a stable hash (browser + OS only, not version) so minor browser
  // updates don't invalidate existing sessions.
  if (req) {
    const ua = req.get('user-agent') || '';
    // Extract browser family
    let browser = 'unknown';
    if (/Edg\//i.test(ua))          browser = 'Edge';
    else if (/OPR\//i.test(ua))     browser = 'Opera';
    else if (/Chrome\//i.test(ua))  browser = 'Chrome';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Safari\//i.test(ua))  browser = 'Safari';
    // Extract platform family
    let platform = 'unknown';
    if (/Windows/i.test(ua))        platform = 'Windows';
    else if (/Macintosh/i.test(ua)) platform = 'Mac';
    else if (/Linux/i.test(ua))     platform = 'Linux';
    else if (/Android/i.test(ua))   platform = 'Android';
    else if (/iPhone|iPad/i.test(ua)) platform = 'iOS';
    payload.fgp = crypto.createHash('sha256').update(`${browser}|${platform}`).digest('hex').substring(0, 16);
  }

  return jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m' }
  );
};

/**
 * Generate refresh token (long-lived)
 * @param {string} userId - User ID
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (userId) => {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET is required. Never share keys between access and refresh tokens.');
  }
  return jwt.sign(
    { 
      id: userId,
      type: 'refresh',
      jti: crypto.randomBytes(16).toString('hex')
    },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
    }
  );
};

/**
 * Store refresh token in Upstash Redis with user session
 * @param {string} userId - User ID
 * @param {string} refreshToken - JWT refresh token
 * @param {Object} req - Express request object (for IP, userAgent)
 * @returns {Promise<boolean>} Success status
 */
const storeRefreshToken = async (userId, refreshToken, req = null) => {
  try {
    const decoded = jwt.decode(refreshToken);
    const tokenId = decoded.jti;
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    
    // Create session data
    const sessionData = {
      userId,
      tokenId,
      refreshToken,
      createdAt: new Date().toISOString(),
      ip: req?.ip || req?.connection?.remoteAddress || 'unknown',
      userAgent: req?.get('user-agent') || 'unknown',
      lastActivity: new Date().toISOString(),
      deviceInfo: req?.headers?.['x-device-info'] || null
    };

    // STORE IN UPSTASH REDIS - Auto-expire when token expires
    await redis.setex(
      `refresh_token:${tokenId}`,
      expiresIn,
      JSON.stringify(sessionData)
    );

    // Store user's active sessions set (for management/revocation)
    await redis.sadd(`user_sessions:${userId}`, tokenId);
    // Keep the set TTL at least as long as the newest token — don't shrink it
    const currentTtl = await redis.ttl(`user_sessions:${userId}`);
    const newTtl = Math.max(currentTtl > 0 ? currentTtl : 0, expiresIn);
    await redis.expire(`user_sessions:${userId}`, newTtl);

    logger.info('✅ Refresh token stored in Upstash Redis', { 
      userId, 
      tokenId,
      expiresIn: `${expiresIn}s`
    });
    
    return true;
  } catch (error) {
    logger.error('❌ Error storing refresh token in Redis:', error);
    return false;
  }
};

/**
 * Verify refresh token and get user session from Redis
 * @param {string} refreshToken - JWT refresh token
 * @returns {Promise<Object|null>} Session data or null if invalid
 */
const verifyRefreshToken = async (refreshToken) => {
  try {
    // Verify JWT signature first
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    if (decoded.type !== 'refresh') {
      logger.warn('❌ Invalid token type for refresh');
      return null;
    }

    // CHECK UPSTASH REDIS - if token exists and not revoked
    const tokenData = await redis.get(`refresh_token:${decoded.jti}`);
    
    let session;
    if (!tokenData) {
      // Token not found in Redis — either revoked, expired, or Redis is unavailable.
      // SECURITY: Never fall back to stateless validation. A missing token in Redis
      // must be treated as revoked to preserve logout/revocation guarantees.
      if (redis._stub) {
        logger.error('❌ Redis unavailable — refresh token rejected (fail-closed). Token revocation cannot be verified without Redis.');
      } else {
        logger.warn('❌ Refresh token not found in Redis (revoked or expired)', { 
          jti: decoded.jti 
        });
      }
      return null;
    } else {
      session = typeof tokenData === 'string' ? JSON.parse(tokenData) : tokenData;
    }
    
    // Verify token matches stored token
    if (session.refreshToken !== refreshToken) {
      logger.warn('❌ Refresh token mismatch', { jti: decoded.jti });
      return null;
    }

    // Update last activity
    session.lastActivity = new Date().toISOString();
    await redis.setex(
      `refresh_token:${decoded.jti}`,
      decoded.exp - Math.floor(Date.now() / 1000),
      JSON.stringify(session)
    );

    logger.info('✅ Refresh token verified from Redis', { 
      userId: session.userId, 
      jti: decoded.jti 
    });
    
    return session;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.info('⏰ Refresh token expired');
      
      // Clean up expired token from Redis
      const decoded = jwt.decode(refreshToken);
      if (decoded?.jti) {
        await redis.del(`refresh_token:${decoded.jti}`);
        logger.info('🧹 Cleaned up expired token from Redis', { jti: decoded.jti });
      }
    } else {
      logger.error('❌ Error verifying refresh token:', error);
    }
    return null;
  }
};

/**
 * Revoke refresh token (logout single device)
 * @param {string} refreshToken - JWT refresh token
 * @returns {Promise<boolean>} Success status
 */
const revokeRefreshToken = async (refreshToken) => {
  try {
    const decoded = jwt.decode(refreshToken);
    if (!decoded?.jti) return false;

    // Get session data to find userId
    const tokenData = await redis.get(`refresh_token:${decoded.jti}`);
    
    if (tokenData) {
      const session = typeof tokenData === 'string' ? JSON.parse(tokenData) : tokenData;
      
      // Remove from user sessions set in Redis
      await redis.srem(`user_sessions:${session.userId}`, decoded.jti);
      
      logger.info('👤 Removed token from user sessions', { 
        userId: session.userId, 
        jti: decoded.jti 
      });
    }

    // DELETE FROM UPSTASH REDIS
    await redis.del(`refresh_token:${decoded.jti}`);
    
    logger.info('✅ Refresh token revoked from Redis', { jti: decoded.jti });
    return true;
  } catch (error) {
    logger.error('❌ Error revoking refresh token:', error);
    return false;
  }
};

/**
 * Revoke all refresh tokens for a user (logout all devices)
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
const revokeAllUserTokens = async (userId) => {
  try {
    // Get all session token IDs for user from Redis
    const tokenIds = await redis.smembers(`user_sessions:${userId}`);
    
    logger.info('🔍 Found user sessions to revoke', { 
      userId, 
      sessionCount: tokenIds.length 
    });
    
    // Delete each token from Redis
    if (tokenIds.length > 0) {
      const deletePromises = tokenIds.map(tokenId => 
        redis.del(`refresh_token:${tokenId}`)
      );
      await Promise.all(deletePromises);
    }
    
    // Delete user sessions set from Redis
    await redis.del(`user_sessions:${userId}`);
    
    logger.info('✅ All user tokens revoked from Redis', { 
      userId, 
      revokedCount: tokenIds.length 
    });
    
    return true;
  } catch (error) {
    logger.error('❌ Error revoking all user tokens:', error);
    return false;
  }
};

/**
 * Clean up expired refresh tokens (maintenance)
 * @returns {Promise<number>} Number of cleaned tokens
 */
const cleanupExpiredTokens = async () => {
  try {
    // Upstash Redis automatically expires keys with TTL
    // This function scans for any leftover or manually clean
    let cursor = '0';
    let cleanedCount = 0;
    
    do {
      // Upstash Redis supports SCAN command
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: 'refresh_token:*',
        count: 100
      });
      
      cursor = nextCursor;
      
      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl <= 0) {
          await redis.del(key);
          cleanedCount++;
        }
      }
    } while (cursor !== '0');

    // Clean stale JTIs from user_sessions sets
    let sessionsCursor = '0';
    let staleCleaned = 0;
    do {
      const [nextCursor, keys] = await redis.scan(sessionsCursor, {
        match: 'user_sessions:*',
        count: 100,
      });
      sessionsCursor = nextCursor;

      for (const setKey of keys) {
        const members = await redis.smembers(setKey);
        for (const jti of members) {
          const exists = await redis.exists(`refresh_token:${jti}`);
          if (!exists) {
            await redis.srem(setKey, jti);
            staleCleaned++;
          }
        }
      }
    } while (sessionsCursor !== '0');
    
    logger.info('🧹 Cleaned expired tokens', { cleanedCount, staleSessions: staleCleaned });
    return cleanedCount + staleCleaned;
  } catch (error) {
    logger.error('❌ Error cleaning expired tokens:', error);
    return 0;
  }
};

/**
 * Get active sessions for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of active sessions
 */
const getUserSessions = async (userId) => {
  try {
    const tokenIds = await redis.smembers(`user_sessions:${userId}`);
    const rawSessions = await Promise.all(
      tokenIds.map((tokenId) => redis.get(`refresh_token:${tokenId}`))
    );

    return rawSessions
      .filter(Boolean)
      .map((tokenData) => {
        const session = typeof tokenData === 'string' ? JSON.parse(tokenData) : tokenData;
        return {
          tokenId: session.tokenId,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          ip: session.ip,
          userAgent: session.userAgent,
          deviceInfo: session.deviceInfo
        };
      });
  } catch (error) {
    logger.error('❌ Error getting user sessions:', error);
    return [];
  }
};

/**
 * Determine if cookies should use the Secure flag.
 * Auto-detects from CLIENT_URL protocol; override with COOKIE_SECURE env var.
 */
const _useSecureCookies = () => {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === 'true';
  }
  return (process.env.CLIENT_URL || '').startsWith('https://');
};

const _cookieSameSite = () => {
  const configured = String(process.env.COOKIE_SAMESITE || '').trim().toLowerCase();
  if (configured === 'none') return 'none';
  if (configured === 'strict') return 'strict';
  if (configured === 'lax') return 'lax';

  // Default to modern cross-site setting only when running secure cookies.
  return _useSecureCookies() ? 'none' : 'lax';
};

const _cookieSecure = () => {
  const configuredSecure = _useSecureCookies();
  const sameSite = _cookieSameSite();

  // Browsers reject SameSite=None cookies unless Secure is true.
  return sameSite === 'none' ? true : configuredSecure;
};

/**
 * Set HTTP-only cookie with refresh token
 * @param {Object} res - Express response object
 * @param {string} refreshToken - JWT refresh token
 */
const setRefreshTokenCookie = (res, refreshToken) => {
  const useSecure = _cookieSecure();
  const sameSite = _cookieSameSite();
  
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,        // Prevents XSS attacks
    secure: useSecure,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth', // Sent to all auth endpoints (refresh, check, logout)
    domain: process.env.COOKIE_DOMAIN || undefined
  });

  logger.debug('🍪 Refresh token cookie set', {
    secure: useSecure,
    sameSite,
    path: '/api/auth'
  });
};

/**
 * Clear refresh token cookie
 * @param {Object} res - Express response object
 */
const clearRefreshTokenCookie = (res) => {
  const useSecure = _cookieSecure();
  const sameSite = _cookieSameSite();

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: useSecure,
    sameSite,
    path: '/api/auth',
    domain: process.env.COOKIE_DOMAIN || undefined,
  });

  logger.debug('🍪 Refresh token cookie cleared');
};

/**
 * Set HTTP-only cookies for BOTH access and refresh tokens.
 * Also sets a non-httpOnly "tokenExists" flag for client-side checks.
 * @param {Object} res - Express response object
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - JWT refresh token
 */
const setTokenCookies = (res, accessToken, refreshToken) => {
  const useSecure = _cookieSecure();
  const sameSite = _cookieSameSite();

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: useSecure,
    sameSite,
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: useSecure,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth',
    domain: process.env.COOKIE_DOMAIN || undefined,
  });

  // httpOnly auth-state flag — prevents client-side script access
  res.cookie('tokenExists', 'true', {
    httpOnly: true,
    secure: useSecure,
    sameSite,
    maxAge: 15 * 60 * 1000,
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
  });

  logger.debug('🍪 Token cookies set');
};

/**
 * Clear both access and refresh token cookies, plus the tokenExists flag.
 * @param {Object} res - Express response object
 */
const clearTokenCookies = (res) => {
  const useSecure = _cookieSecure();
  const sameSite = _cookieSameSite();

  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: useSecure,
    sameSite,
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
  });

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: useSecure,
    sameSite,
    path: '/api/auth',
    domain: process.env.COOKIE_DOMAIN || undefined,
  });

  res.clearCookie('tokenExists', {
    httpOnly: true,
    secure: useSecure,
    sameSite,
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
  });

  logger.debug('🍪 Token cookies cleared');
};

/**
 * Revoke a refresh token by its JTI (token ID) directly.
 * Also removes the JTI from the user's session set to prevent stale references.
 * @param {string} jti - The JWT ID to revoke
 * @returns {Promise<boolean>} Success status
 */
const revokeRefreshTokenByJti = async (jti) => {
  try {
    // Read session data first so we can clean up user_sessions set
    const sessionRaw = await redis.get(`refresh_token:${jti}`);
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        if (session.userId) {
          await redis.srem(`user_sessions:${session.userId}`, jti);
        }
      } catch (_) {
        // Malformed session data — still delete the token key below
      }
    }
    await redis.del(`refresh_token:${jti}`);
    logger.info('✅ Refresh token revoked by JTI', { jti });
    return true;
  } catch (error) {
    logger.error('❌ Error revoking refresh token by JTI:', error);
    return false;
  }
};

/**
 * Refresh access token using refresh token (Token Rotation)
 * Uses a Redis lock (SETNX) to prevent concurrent refreshes
 * from racing and creating orphaned tokens.
 * @param {string} refreshToken - JWT refresh token
 * @returns {Promise<Object|null>} New tokens or null if failed
 */
const refreshTokens = async (refreshToken, req = null) => {
  let lockKey = null;
  let lockOwner = null;
  try {
    // Decode to get jti for the lock key
    const decodedJwt = jwt.decode(refreshToken);
    if (!decodedJwt?.jti) return { error: 'invalid' };

    lockKey = `refresh_lock:${decodedJwt.jti}`;
    lockOwner = crypto.randomBytes(16).toString('hex');

    // Acquire a short-lived lock so only the first request proceeds.
    // SETNX returns 1 if the key was set (lock acquired), 0 if it already existed.
    const lockAcquired = await redis.set(lockKey, lockOwner, { ex: 10, nx: true });

    if (!lockAcquired) {
      // Another request is already refreshing this exact token.
      // Wait briefly for the winner to finish.
      lockOwner = null;
      logger.info('🔒 Refresh lock exists — waiting for first request to finish', {
        jti: decodedJwt.jti,
      });

      // Wait up to 5 seconds for the first request to complete
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const lockStillExists = await redis.get(lockKey);
        if (!lockStillExists) break;
      }

      // Return a special marker so the caller can distinguish
      // "concurrent refresh (not an error)" from "truly invalid token".
      // This prevents the middleware from sending INVALID_REFRESH_TOKEN
      // which would force-logout the user.
      return { concurrentRefresh: true };
    }

    // --- Lock acquired: proceed with rotation ---

    // Verify refresh token in Redis
    const session = await verifyRefreshToken(refreshToken);
    if (!session) {
      // Token is genuinely invalid / expired / revoked in Redis
      return { error: 'invalid' };
    }

    // Generate new tokens (ROTATION)
    const newAccessToken = generateAccessToken(session.userId, req);
    const newRefreshToken = generateRefreshToken(session.userId);

    // Grace period: keep the old token alive for 30 seconds instead of
    // deleting it immediately. This covers the window where the server
    // rotated the token but the new cookie didn't reach the client
    // (e.g., network blip, MongoDB reconnection, browser didn't process
    // the Set-Cookie from the response). After 30s it auto-expires.
    const oldDecoded = jwt.decode(refreshToken);
    if (oldDecoded?.jti) {
      await redis.setex(
        `refresh_token:${oldDecoded.jti}`,
        30, // 30 second grace period
        JSON.stringify({ ...session, gracePeriod: true })
      );
      logger.info('⏳ Old refresh token kept with 30s grace period', { jti: oldDecoded.jti });
    }
    
    // Store new refresh token in Redis
    await storeRefreshToken(session.userId, newRefreshToken);

    logger.info('🔄 Token rotation complete', { 
      userId: session.userId,
      oldToken: decodedJwt.jti,
      newToken: jwt.decode(newRefreshToken).jti
    });

    return {
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    };
  } catch (error) {
    logger.error('❌ Error refreshing tokens (transient):', error);
    // Transient error (Redis timeout, network blip) — don't treat as invalid.
    // The caller must NOT clear the cookie for transient failures.
    return { error: 'transient' };
  } finally {
    // Release only the lock owned by this request.
    if (lockKey && lockOwner) {
      await redis
        .get(lockKey)
        .then(async (currentOwner) => {
          if (currentOwner === lockOwner) {
            await redis.del(lockKey);
          }
        })
        .catch(() => {});
    }
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokenByJti,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  getUserSessions,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  setTokenCookies,
  clearTokenCookies,
  refreshTokens,
  maskOtp,
};