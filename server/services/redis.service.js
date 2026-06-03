const redis = require("../config/redis");
const { logger } = require("../utils/logger");

class RedisService {
  // Store pending registration data
  static async storePendingRegistration(email, userData) {
    try {
      const key = `pending_registration:${email}`;
      const dataString = JSON.stringify(userData);
      logger.info('[Redis] Storing pending registration', { email });

      await redis.setex(key, 600, dataString);
      return true;
    } catch (error) {
      logger.error('Error storing pending registration', { error: error.message });
      return false;
    }
  }

  // Get pending registration data
  static async getPendingRegistration(email) {
    try {
      const key = `pending_registration:${email}`;
      const data = await redis.get(key);

      if (!data) {
        logger.info('[Redis] No pending registration found', { email });
        return null;
      }

      logger.info('[Redis] Found pending registration', { email });

      let parsedData;
      try {
        if (typeof data === "string") {
          parsedData = JSON.parse(data);
        } else if (typeof data === "object") {
          parsedData = data;
        } else {
          logger.warn('[Redis] Unexpected data type', { type: typeof data });
          return null;
        }
      } catch (parseError) {
        logger.error('[Redis] JSON parse error', { error: parseError.message });
        return null;
      }

      return parsedData;
    } catch (error) {
      logger.error('Error getting pending registration', { error: error.message });
      return null;
    }
  }

  // Delete pending registration data
  static async deletePendingRegistration(email) {
    try {
      const key = `pending_registration:${email}`;
      await redis.del(key);
      logger.info('[Redis] Deleted pending registration', { email });
      return true;
    } catch (error) {
      logger.error('Error deleting pending registration', { error: error.message });
      return false;
    }
  }

// ============== SECURE: Store OTP as HMAC-SHA-256 hash ==============
// HMAC-SHA-256 with a server secret key prevents offline brute-force:
// even if the Redis dump is leaked, an attacker cannot enumerate the
// 6-digit space (1 000 000 combos) without knowing the HMAC secret.
static _otpHmac(otp) {
  const crypto = require('crypto');
  const secret =
    process.env.OTP_HMAC_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_SECRET;
  if (!secret) throw new Error('OTP_HMAC_SECRET is not configured');
  return crypto.createHmac('sha256', secret).update(String(otp).trim()).digest('hex');
}

static async storeOTP(email, otp) {
  try {
    const key = `otp:${email}`;
    const otpHash = this._otpHmac(otp);
    await redis.setex(key, 300, otpHash);
    return true;
  } catch (error) {
    logger.error('Error storing OTP', { error: error.message });
    return false;
  }
}

  // ============== FIXED: Increment OTP attempts and check lock (BLOCK AFTER 3 ATTEMPTS) ==============
  static async incrementOTPAttempts(email, metadata = {}) {
    try {
      const key = `otp_attempts:${email}`;
      const attempts = await redis.incr(key);

      // Set expiry if this is the first attempt
      if (attempts === 1) {
        await redis.expire(key, 300); // Reset after 5 minutes
      }

      // Keep a detailed, human-readable record for Upstash visibility.
      const detailsKey = `otp_wrong_attempts:${email}`;
      const currentRaw = await redis.get(detailsKey);
      let current = null;
      if (currentRaw) {
        current = typeof currentRaw === "string" ? JSON.parse(currentRaw) : currentRaw;
      }

      const now = new Date().toISOString();

      // Build attempt history log
      const attemptHistory = current?.attemptHistory || [];
      attemptHistory.push({
        attemptNumber: attempts,
        timestamp: now,
      });

      const details = {
        userId: metadata.userId || current?.userId || null,
        userName: metadata.userName || current?.userName || null,
        email,
        phone: metadata.phone || current?.phone || null,
        provider: metadata.provider || current?.provider || null,
        context: metadata.context || current?.context || "otp_verification",
        wrongOtpCount: attempts,
        blocked: attempts >= 3,
        firstAttemptAt: current?.firstAttemptAt || now,
        lastAttemptAt: now,
        attemptHistory,
      };

      await redis.setex(detailsKey, 86400, JSON.stringify(details));

      logger.info('[Redis] OTP attempts', { email, attempts });

      // Block email if too many attempts (3+ attempts)
      if (attempts >= 3) {
        await this.blockOTPEmail(email, 60, details);
        return { attempts, blocked: true, blockDuration: 60 };
      }

      return { attempts, blocked: false };
    } catch (error) {
      logger.error('Error incrementing OTP attempts', { error: error.message });
      return { attempts: 1, blocked: false };
    }
  }

  // ============== FIXED: Block email for OTP attempts ==============
  static async blockOTPEmail(email, seconds, userDetails = {}) {
    try {
      const key = `blocked_otp:${email}`;
      const now = new Date().toISOString();

      // Store rich user details instead of bare "true"
      const blockedData = {
        userId: userDetails.userId || null,
        userName: userDetails.userName || null,
        email,
        phone: userDetails.phone || null,
        provider: userDetails.provider || null,
        context: userDetails.context || "otp_verification",
        wrongOtpCount: userDetails.wrongOtpCount || 0,
        blocked: true,
        blockedAt: now,
        blockedDuration: `${seconds} seconds`,
        attemptHistory: userDetails.attemptHistory || [],
      };

      await redis.setex(key, seconds, JSON.stringify(blockedData));
      logger.info('[Redis] Blocked OTP for email', { email, seconds });

      const blockInfoKey = `otp_block_info:${email}`;
      const blockInfo = {
        userId: userDetails.userId || null,
        userName: userDetails.userName || null,
        email,
        phone: userDetails.phone || null,
        blockedAt: now,
        duration: seconds,
        expiresIn: seconds,
        totalWrongAttempts: userDetails.wrongOtpCount || 0,
      };
      await redis.setex(blockInfoKey, seconds, JSON.stringify(blockInfo));

      return true;
    } catch (error) {
      logger.error('Error blocking OTP email', { error: error.message });
      return false;
    }
  }

  // ============== FIXED: Check if OTP is blocked ==============
  static async checkOTPBlocked(email) {
    try {
      const key = `blocked_otp:${email}`;
      const data = await redis.get(key);

      if (data) {
        const ttl = await redis.ttl(key);
        logger.info('[Redis] OTP blocked', { email, ttl });
        return { blocked: true, remainingSeconds: ttl };
      }

      logger.info('[Redis] OTP not blocked', { email });
      return { blocked: false, remainingSeconds: 0 };
    } catch (error) {
      logger.error('Error checking OTP blocked', { error: error.message });
      return { blocked: false, remainingSeconds: 0 };
    }
  }

  // ============== FIXED: Get OTP block info ==============
  static async getOTPBlockInfo(email) {
    try {
      const key = `otp_block_info:${email}`;
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      let parsedData;
      try {
        if (typeof data === "string") {
          parsedData = JSON.parse(data);
        } else if (typeof data === "object") {
          parsedData = data;
        }

        const ttl = await redis.ttl(`blocked_otp:${email}`);
        parsedData.expiresIn = ttl;

        return parsedData;
      } catch (parseError) {
        logger.error('[Redis] JSON parse error', { error: parseError.message });
        return null;
      }
    } catch (error) {
      logger.error('Error getting OTP block info', { error: error.message });
      return null;
    }
  }

  // ============== FIXED: Clear OTP attempts ==============
  static async clearOTPAttempts(email) {
    try {
      const key = `otp_attempts:${email}`;
      await redis.del(key);
      logger.info('[Redis] Cleared OTP attempts', { email });
      return true;
    } catch (error) {
      logger.error('Error clearing OTP attempts', { error: error.message });
      return false;
    }
  }

  // ============== FIXED: Clear OTP block ==============
  static async clearOTPBlock(email) {
    try {
      const blockKey = `blocked_otp:${email}`;
      const blockInfoKey = `otp_block_info:${email}`;
      await redis.del(blockKey);
      await redis.del(blockInfoKey);
      logger.info('[Redis] Cleared OTP block', { email });
      return true;
    } catch (error) {
      logger.error('Error clearing OTP block', { error: error.message });
      return false;
    }
  }

  // ============== SECURE: Verify OTP using HMAC-SHA-256 ==============
  static async verifyOTP(email, otp) {
    try {
      const key = `otp:${email}`;
      const storedHash = await redis.get(key);

      if (!storedHash) {
        return { valid: false, reason: "OTP expired or not found" };
      }

      // Compute HMAC of the received OTP and compare with stored HMAC
      const receivedHash = this._otpHmac(otp);
      const storedHashStr = String(storedHash).trim();

      const crypto = require('crypto');
      // Timing-safe comparison prevents timing side-channel attacks
      const hashesMatch =
        storedHashStr.length === receivedHash.length &&
        crypto.timingSafeEqual(Buffer.from(storedHashStr), Buffer.from(receivedHash));

      if (!hashesMatch) {
        return { valid: false, reason: "Invalid OTP" };
      }

      // Delete OTP after successful verification (one-time use)
      await redis.del(key);
      return { valid: true };
    } catch (error) {
      logger.error('Error verifying OTP', { error: error.message });
      return { valid: false, reason: "Server error during OTP verification" };
    }
  }

  // Check if email exists in database (for rate limiting)
  static async checkEmailBlocked(email) {
    try {
      const key = `blocked_email:${email}`;
      const exists = await redis.exists(key);
      logger.info('[Redis] Check email blocked', { email, blocked: exists === 1 });
      return exists === 1;
    } catch (error) {
      logger.error('Error checking blocked email', { error: error.message });
      return false;
    }
  }

  // Set email exists flag (for rate limiting)
  static async setEmailExists(email) {
    try {
      const key = `email_exists:${email}`;
      await redis.setex(key, 3600, "true");
      logger.info('[Redis] Set email exists flag', { email });
      return true;
    } catch (error) {
      logger.error('Error setting email exists flag', { error: error.message });
      return false;
    }
  }

  // Rate limiting methods
  static async incrementRegistrationAttempts(email) {
    try {
      const key = `reg_attempts:${email}`;
      const attempts = await redis.incr(key);

      if (attempts === 1) {
        await redis.expire(key, 3600);
      }

      logger.info('[Redis] Registration attempts', { email, attempts });

      if (attempts >= 5) {
        await this.blockEmail(email, 3600);
      }

      return attempts;
    } catch (error) {
      logger.error('Error incrementing registration attempts', { error: error.message });
      return 1;
    }
  }

  // Block email
  static async blockEmail(email, seconds) {
    try {
      const key = `blocked_email:${email}`;
      await redis.setex(key, seconds, "true");
      logger.info('[Redis] Blocked email', { email, seconds });
      return true;
    } catch (error) {
      logger.error('Error blocking email', { error: error.message });
      return false;
    }
  }

  static async clearRegistrationAttempts(email) {
    try {
      const key = `reg_attempts:${email}`;
      await redis.del(key);
      logger.info('[Redis] Cleared registration attempts', { email });
      return true;
    } catch (error) {
      logger.error('Error clearing registration attempts', { error: error.message });
      return false;
    }
  }

  // Check if OTP exists
  static async checkOTPExists(email) {
    try {
      const key = `otp:${email}`;
      const exists = await redis.exists(key);
      logger.info('[Redis] OTP exists check', { email, exists: exists === 1 });
      return exists === 1;
    } catch (error) {
      logger.error('Error checking OTP exists', { error: error.message });
      return false;
    }
  }

  // Health check
  static async healthCheck() {
    try {
      const result = await redis.ping();
      logger.info('[Redis] Health check', { result });
      return "connected";
    } catch (error) {
      logger.error('Redis health check failed', { error: error.message });
      return "disconnected";
    }
  }

// ============== FIXED: Store pending password reset with consistent structure ==============
static async storePendingPasswordReset(email, resetData) {
  try {
    const key = `pending_password_reset:${email}`;
    
    // FIX: Ensure data has required fields
    if (!resetData.userId) {
      logger.error('[Redis] Missing userId in reset data', { email });
      return false;
    }
    
    if (!resetData.email) {
      logger.error('[Redis] Missing email in reset data', { email });
      resetData.email = email; // Add email if missing
    }
    
    const dataString = JSON.stringify(resetData);
    logger.info('[Redis] Storing pending password reset', { email, userId: resetData.userId });

    await redis.setex(key, 600, dataString);
    return true;
  } catch (error) {
    logger.error('Error storing pending password reset', { error: error.message });
    return false;
  }
}

// ============== FIXED: Get pending password reset data with better error handling ==============
static async getPendingPasswordReset(email) {
  try {
    const key = `pending_password_reset:${email}`;
    const data = await redis.get(key);

    if (!data) {
      logger.info('[Redis] No pending password reset found', { email });
      return null;
    }

logger.info('[Redis] Found pending password reset', { email });

    let parsedData;
    try {
      if (typeof data === "string") {
        parsedData = JSON.parse(data);
      } else if (typeof data === "object") {
        parsedData = data;
      } else {
        logger.warn('[Redis] Unexpected data type in password reset', { type: typeof data });
        return null;
      }
      
      // FIX: Ensure we have required fields
      if (!parsedData.userId) {
        logger.warn('[Redis] Missing userId in pending reset data');
        return null;
      }
      
      return parsedData;
    } catch (parseError) {
      logger.error('[Redis] JSON parse error in password reset', { error: parseError.message });
      return null;
    }
  } catch (error) {
    logger.error('Error getting pending password reset', { error: error.message });
    return null;
  }
}

  // Delete pending password reset
  static async deletePendingPasswordReset(email) {
    try {
      const key = `pending_password_reset:${email}`;
      await redis.del(key);
      logger.info('[Redis] Deleted pending password reset', { email });
      return true;
    } catch (error) {
      logger.error('Error deleting pending password reset', { error: error.message });
      return false;
    }
  }

  // Store password reset token
  static async storePasswordResetToken(email, token) {
    try {
      const key = `password_reset_token:${email}`;
      logger.info('[Redis] Storing password reset token', { email });

      await redis.setex(key, 600, token);
      return true;
    } catch (error) {
      logger.error('Error storing password reset token', { error: error.message });
      return false;
    }
  }

  // Verify password reset token
  static async verifyPasswordResetToken(email, token) {
    try {
      const key = `password_reset_token:${email}`;
      const storedToken = await redis.get(key);

      if (!storedToken) {
        return false;
      }

      return storedToken === token;
    } catch (error) {
      logger.error('Error verifying password reset token', { error: error.message });
      return false;
    }
  }

  // Delete password reset token
  static async deletePasswordResetToken(email) {
    try {
      const key = `password_reset_token:${email}`;
      await redis.del(key);
      logger.info('[Redis] Deleted password reset token', { email });
      return true;
    } catch (error) {
      logger.error('Error deleting password reset token', { error: error.message });
      return false;
    }
  }

  // Delete OTP
  static async deleteOTP(email) {
    try {
      const key = `otp:${email}`;
      await redis.del(key);
      logger.info('[Redis] Deleted OTP', { email });
      return true;
    } catch (error) {
      logger.error('Error deleting OTP', { error: error.message });
      return false;
    }
  }

  // ==================== PROFILE IMAGE CACHE ====================
  // Stores the most recent profile image URL per user (keyed by email).
  // Max 5 users cached, 30-day TTL.
  // This cache survives logout so the image loads instantly on re-login.

  static IMAGE_CACHE_PREFIX = "profile_image_cache";
  static IMAGE_CACHE_INDEX = "profile_image_cache:index"; // sorted set: email → timestamp
  static IMAGE_CACHE_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
  static IMAGE_CACHE_MAX = 5;

  /**
   * Cache a user's profile image URL in Redis.
   * Evicts the oldest entry when the cache exceeds 5 users.
   */
  static async cacheProfileImage(email, { url, name = null }) {
    if (!email || !url) return false;
    try {
      const key = `${this.IMAGE_CACHE_PREFIX}:${email.toLowerCase()}`;
      const data = JSON.stringify({ url, name, cachedAt: Date.now() });

      // Store the image data with TTL
      await redis.setex(key, this.IMAGE_CACHE_TTL, data);

      // Track in sorted set (score = timestamp) for LRU eviction
      await redis.zadd(this.IMAGE_CACHE_INDEX, { score: Date.now(), member: email.toLowerCase() });

      // Evict oldest if more than 5 entries
      const count = await redis.zcard(this.IMAGE_CACHE_INDEX);
      if (count > this.IMAGE_CACHE_MAX) {
        // Get the oldest entries beyond the limit
        const toRemove = await redis.zrange(this.IMAGE_CACHE_INDEX, 0, count - this.IMAGE_CACHE_MAX - 1);
        for (const oldEmail of toRemove) {
          await redis.del(`${this.IMAGE_CACHE_PREFIX}:${oldEmail}`);
          await redis.zrem(this.IMAGE_CACHE_INDEX, oldEmail);
        }
        logger.info('[Redis] Evicted old image cache entries', { count: toRemove.length });
      }

      logger.info('[Redis] Cached profile image', { email });
      return true;
    } catch (error) {
      logger.error('[Redis] Error caching profile image', { error: error.message });
      return false;
    }
  }

  /**
   * Retrieve a cached profile image URL for a user.
   * Returns { url, name, cachedAt } or null.
   */
  static async getCachedProfileImage(email) {
    if (!email) return null;
    try {
      const key = `${this.IMAGE_CACHE_PREFIX}:${email.toLowerCase()}`;
      const data = await redis.get(key);
      if (!data) return null;

      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      logger.info('[Redis] Cache hit for profile image', { email });
      return parsed;
    } catch (error) {
      logger.error('[Redis] Error getting cached profile image', { error: error.message });
      return null;
    }
  }

  /**
   * Remove a specific user's cached image (e.g. account deletion).
   */
  static async removeCachedProfileImage(email) {
    if (!email) return false;
    try {
      const lowerEmail = email.toLowerCase();
      await redis.del(`${this.IMAGE_CACHE_PREFIX}:${lowerEmail}`);
      await redis.zrem(this.IMAGE_CACHE_INDEX, lowerEmail);
      logger.info('[Redis] Removed cached profile image', { email });
      return true;
    } catch (error) {
      logger.error('[Redis] Error removing cached profile image', { error: error.message });
      return false;
    }
  }

  // ============== BLOCKED USER TRACKING IN REDIS ==============

  /**
   * Track every wrong password attempt with full user details.
   * Key: wrong_password:<email>  |  TTL: 24 hours
   * Visible in Upstash Redis dashboard.
   */
  static async trackWrongPasswordAttempt(details) {
    try {
      const key = `wrong_password:${details.email}`;
      const now = new Date().toISOString();

      // Fetch existing record to accumulate history
      const currentRaw = await redis.get(key);
      let current = null;
      if (currentRaw) {
        current = typeof currentRaw === "string" ? JSON.parse(currentRaw) : currentRaw;
      }

      const attemptHistory = current?.attemptHistory || [];
      attemptHistory.push({
        attemptNumber: details.currentAttempt,
        ip: details.ip,
        userAgent: details.userAgent,
        timestamp: now,
      });

      const record = {
        userId: details.userId,
        userName: details.name,
        email: details.email,
        phone: details.phone || null,
        provider: details.provider || "local",
        wrongPasswordCount: details.currentAttempt,
        maxAttemptsBeforeBlock: 5,
        blocked: details.currentAttempt >= 5,
        blockedDuration: details.currentAttempt >= 5 ? "5 minutes" : null,
        firstAttemptAt: current?.firstAttemptAt || now,
        lastAttemptAt: now,
        attemptHistory,
      };

      await redis.setex(key, 86400, JSON.stringify(record));
      logger.info('[Redis] Tracked wrong password attempt', { email: details.email, attempt: details.currentAttempt });
      return true;
    } catch (error) {
      logger.error('[Redis] Error tracking wrong password attempt', { error: error.message });
      return false;
    }
  }

  /**
   * Clear wrong password tracking after successful login.
   */
  static async clearWrongPasswordAttempts(email) {
    try {
      const key = `wrong_password:${email}`;
      await redis.del(key);
      logger.info('[Redis] Cleared wrong password attempts', { email });
      return true;
    } catch (error) {
      logger.error('[Redis] Error clearing wrong password attempts', { error: error.message });
      return false;
    }
  }

  /**
   * Store blocked user details in Redis when account is locked after
   * too many failed login attempts. Visible in Upstash Redis dashboard.
   * Key: blocked_user:<email>  |  TTL: 5 minutes (matches MongoDB lockUntil).
   */
  static async storeBlockedUser(userDetails) {
    try {
      const key = `blocked_user:${userDetails.email}`;
      const now = new Date();
      const blockedUntil = new Date(now.getTime() + 5 * 60 * 1000);
      const data = JSON.stringify({
        userId: userDetails.userId,
        name: userDetails.name,
        email: userDetails.email,
        phone: userDetails.phone || null,
        reason: "Too many failed login attempts (5+)",
        failedAttempts: userDetails.failedAttempts,
        blockedAt: now.toISOString(),
        blockedUntil: blockedUntil.toISOString(),
        blockedDuration: "5 minutes",
        lastIp: userDetails.ip,
        lastUserAgent: userDetails.userAgent,
      });

      // TTL = 5 minutes (matches lockUntil in MongoDB)
      await redis.setex(key, 300, data);
      logger.warn('[Redis] Stored blocked user', { email: userDetails.email, name: userDetails.name });
      return true;
    } catch (error) {
      logger.error('[Redis] Error storing blocked user', { error: error.message });
      return false;
    }
  }

  /**
   * Remove blocked user record from Redis (e.g. on successful login after lock expires).
   */
  static async removeBlockedUser(email) {
    try {
      const key = `blocked_user:${email}`;
      await redis.del(key);
      logger.info('[Redis] Removed blocked user record', { email });
      return true;
    } catch (error) {
      logger.error('[Redis] Error removing blocked user', { error: error.message });
      return false;
    }
  }

  /**
   * Get blocked user details from Redis.
   */
  static async getBlockedUser(email) {
    try {
      const key = `blocked_user:${email}`;
      const data = await redis.get(key);
      if (!data) return null;
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (error) {
      logger.error('[Redis] Error getting blocked user', { error: error.message });
      return null;
    }
  }
}

module.exports = RedisService;
