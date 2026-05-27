const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const RedisService = require("../services/redis.service");
const EmailService = require("../services/email.service");
const OTPGenerator = require("../utils/otpGenerator");
const argon2 = require("argon2");
const { logger } = require("../utils/logger");
const { invalidateEntityCache } = require("../middleware/cache.middleware");
const { handleGoogleAuth } = require("../services/googleAuth.OAuth");
const TwilioService = require("../services/twilio.service");
const passwordSecurity = require("../utils/passwordSecurity");
const { createNotification } = require("./notification.controller");
const deviceService = require("../services/device.service");
const s3Service = require("../services/s3.service");
const crypto = require("crypto");
const mongoose = require("mongoose");
const redis = require("../config/redis");
const { invalidateAuthCache } = require("../middleware/auth.middleware");

// ── RabbitMQ Producers (non-blocking async side-effects) ───────────────────────
const {
  publishOTPEmail,
  publishWelcomeEmail,
  publishLoginNotificationEmail,
  publishPasswordResetSuccessEmail,
  publishSecurityAlert,
  publishAuditLog,
} = require('../queues/producers/auth.producer');

// ==================== TOKEN UTILITIES (single source of truth) ====================
const {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokenByJti,
  revokeAllUserTokens,
  setTokenCookies,
  clearTokenCookies,
  refreshTokens,
  maskOtp,
} = require("../utils/tokenUtils");

const PROFILE_CACHE_TTL_SECONDS = 300;
const DEVICES_CACHE_TTL_SECONDS = 180;
const ACTIVITY_CACHE_TTL_SECONDS = 180;

const getResolvedProfileImage = (user) =>
  s3Service.toProxyUrl(
    user?.getProfileImage
      ? user.getProfileImage()
      : user?.profileImage || user?.googleProfileImage || user?.avatar || null,
  );

const readJsonCache = async (key) => {
  try {
    const cached = await redis.get(key);
    if (!cached) return null;
    return typeof cached === 'string' ? JSON.parse(cached) : cached;
  } catch (_) {
    return null;
  }
};

const writeJsonCache = async (key, value, ttlSeconds) => {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (_) {
    // Non-fatal cache path.
  }
};

const invalidateAccountCaches = async (userId) => {
  try {
    const id = String(userId);
    invalidateAuthCache(id);
    await Promise.all([
      redis.del(`profile:${id}`),
      redis.del(`devices:${id}`),
      redis.del(`activity:${id}`),
      redis.del(`settings:${id}`),
    ]);
  } catch (_) {
    // Non-fatal cache path.
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Send token response with HTTP-only cookies
 */
const sendTokenResponse = async (user, statusCode, res, message) => {
  try {
    const accessToken = generateAccessToken(user._id, res.req);
    const refreshToken = generateRefreshToken(user._id);

    const stored = await storeRefreshToken(user._id.toString(), refreshToken, res.req);
    if (!stored) {
      logger.error('Failed to store refresh token in Redis', { userId: user._id });
      clearTokenCookies(res);
      return res.status(503).json({
        success: false,
        message: 'Authentication service temporarily unavailable. Please try again.',
      });
    }
    setTokenCookies(res, accessToken, refreshToken);

    const profileImageUrl = s3Service.toProxyUrl(
      user.getProfileImage ? user.getProfileImage() : 
      (user.profileImage || user.googleProfileImage || user.avatar || null)
    );

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      provider: user.provider,
      hasPassword: !!user.password,
      avatar: user.avatar,
      profileImage: s3Service.toProxyUrl(user.profileImage) || null,
      profileImageKey: user.profileImageKey || null,
      googleProfileImage: user.googleProfileImage || null,
      isVerified: user.isVerified,
      profileImageUrl: profileImageUrl,
      passwordExpiration: user.passwordNeedsChange
        ? user.passwordNeedsChange()
        : null,
      devices: user.devices
        ? user.devices.map((d) => deviceService.formatDeviceForDisplay(d))
        : [],
    };

    logger.info("✅ Token response sent with HTTP-only cookies", {
      userId: user._id,
    });

    res.status(statusCode).json({
      success: true,
      message,
      user: userResponse,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error("❌ Error sending token response:", error);
    res.status(500).json({
      success: false,
      message: "Error generating authentication tokens",
    });
  }
};

// ==================== FIXED: LOGIN WITH PROPER TOKEN STORAGE ====================
exports.login = async (req, res) => {
  try {
    const { email, phone, identity, password } = req.body;
    const invalidCredentialsMessage =
      "Invalid email or password. Please try again.";
    const rawIdentity = String(identity || email || phone || '').trim();
    const isEmailIdentity = rawIdentity.includes('@');
    const normalizedEmail = isEmailIdentity ? rawIdentity.toLowerCase() : null;
    const normalizedPhone = !isEmailIdentity
      ? TwilioService.normalizePhone(rawIdentity)
      : null;

    logger.info("🔍 Login attempt for:", {
      identity: isEmailIdentity ? normalizedEmail : normalizedPhone,
      isEmailIdentity,
    });

    if (!rawIdentity || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide identity and password",
      });
    }

    const findQuery = isEmailIdentity
      ? { email: normalizedEmail }
      : {
          $or: [
            { phone: normalizedPhone },
            { phone: rawIdentity },
            { phone: `+${rawIdentity.replace(/^\+/, '')}` },
          ],
        };

    const user = await User.findOne(findQuery).select(
      "+password +passwordHistory +devices +loginHistory",
    );

    if (!user) {
      logger.userLog('login', {
        identity: rawIdentity,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        success: false,
        reason: 'user_not_found',
      });
      return res.status(401).json({
        success: false,
        message: invalidCredentialsMessage,
        code: "INVALID_CREDENTIALS",
      });
    }

    // Google accounts can use email/password login only after setting a password.
    if (user.provider === "google" && !user.password) {
      logger.userLog('login', {
        identity: rawIdentity,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        success: false,
        reason: 'google_provider_password_login',
      });
      return res.status(401).json({
        success: false,
        message: invalidCredentialsMessage,
        code: "INVALID_CREDENTIALS",
      });
    }

    if (!user.password) {
      logger.userLog('login', {
        identity: rawIdentity,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        success: false,
        reason: 'password_not_set',
      });
      return res.status(401).json({
        success: false,
        message: invalidCredentialsMessage,
        code: "INVALID_CREDENTIALS",
      });
    }

    // Check account lockout BEFORE expensive password comparison
    if (user.isLocked && user.isLocked()) {
      if (user.addLoginHistory) {
        const failLocation = deviceService.getLocationFromIP(req.ip);
        await user.addLoginHistory({
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
          location: failLocation,
          loginType: "email",
          success: false,
          failureReason: "account_locked",
        });
      }
      return res.status(423).json({
        success: false,
        message:
          "Account is temporarily locked due to too many failed attempts. Please try again after 5 minutes or reset your password.",
        locked: true,
        code: 'ACCOUNT_LOCKED',
      });
    }

    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      // Increment failed login attempts (locks after 5 failures)
      if (user.incrementLoginAttempts) {
        await user.incrementLoginAttempts();
      }

      // Track wrong password attempts in Redis with full details
      const currentAttempts = (user.loginAttempts || 0) + 1;
      await RedisService.trackWrongPasswordAttempt({
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        provider: user.provider || "local",
        currentAttempt: currentAttempts,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });

      // Store blocked user details in Redis if account just got locked
      if (currentAttempts >= 5) {
        await RedisService.storeBlockedUser({
          userId: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone || null,
          failedAttempts: currentAttempts,
          ip: req.ip,
          userAgent: req.get("user-agent"),
        });
      }

      // Log failed login attempt
      if (user.addLoginHistory) {
        const failLocation = deviceService.getLocationFromIP(req.ip);
        await user.addLoginHistory({
          ipAddress: req.ip,
          userAgent: req.get("user-agent"),
          location: failLocation,
          loginType: "email",
          success: false,
          failureReason: "invalid_password",
        });
      }

      // Log security event
      if (user.addSecurityLog) {
        await user.addSecurityLog(
          "failed_login",
          req.ip,
          req.get("user-agent"),
          { reason: "invalid_password", attempt: currentAttempts }
        );
      }

      logger.userLog('login', {
        identity: rawIdentity,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        success: false,
        reason: 'invalid_password',
      });
      return res.status(401).json({
        success: false,
        message: invalidCredentialsMessage,
        code: "INVALID_CREDENTIALS",
      });
    }

    // Generate tokens (pass req for fingerprint binding)
    const accessToken = generateAccessToken(user._id, req);
    const refreshToken = generateRefreshToken(user._id);
    const decoded = jwt.decode(refreshToken);

    // Create device session
    const deviceSession = await deviceService.createDeviceSession(req, decoded.jti);

    // Update user devices
    await user.updateDeviceSession(deviceSession, decoded.jti);

    // Add to login history
    await user.addLoginHistory({
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      deviceId: deviceSession.deviceId,
      deviceName: deviceSession.deviceName,
      location: deviceSession.location,
      loginType: isEmailIdentity ? "email" : "phone",
      success: true,
    });

    if (user.resetLoginAttempts) {
      await user.resetLoginAttempts();
    }

    // Clear blocked user record and wrong password tracking from Redis
    const redisIdentityKey = isEmailIdentity
      ? normalizedEmail
      : String(normalizedPhone || rawIdentity).replace(/^\+/, '');
    await RedisService.removeBlockedUser(redisIdentityKey);
    await RedisService.clearWrongPasswordAttempts(redisIdentityKey);

    // Store tokens in Redis
    const stored = await storeRefreshToken(user._id.toString(), refreshToken, req);
    if (!stored) {
      logger.error('Failed to store refresh token in Redis', { userId: user._id });
      clearTokenCookies(res);
      return res.status(503).json({
        success: false,
        message: 'Authentication service temporarily unavailable. Please try again.',
      });
    }
    
    // Set cookies
    setTokenCookies(res, accessToken, refreshToken);

    // Prepare user response with profile image URL
    const profileImageUrl = s3Service.toProxyUrl(
      user.getProfileImage ? user.getProfileImage() : 
      (user.profileImage || user.googleProfileImage || user.avatar || null)
    );

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      provider: user.provider,
      hasPassword: !!user.password,
      avatar: user.avatar,
      profileImage: s3Service.toProxyUrl(user.profileImage) || null,
      profileImageKey: user.profileImageKey || null,
      googleProfileImage: user.googleProfileImage || null,
      isVerified: user.isVerified,
      profileImageUrl: profileImageUrl,
      devices: user.devices.map((d) => deviceService.formatDeviceForDisplay(d)),
      currentDevice: deviceService.formatDeviceForDisplay(deviceSession),
      passwordExpiration: user.passwordNeedsChange
        ? user.passwordNeedsChange()
        : null,
    };

    // Check Redis image cache — if user logged out earlier, their image is here
    let cachedImage = null;
    try {
      const cached = await RedisService.getCachedProfileImage(user.email);
      if (cached?.url) {
        cachedImage = cached;
      }
    } catch (_) { /* non-critical */ }

    logger.info(`✅ Login successful for: ${user.email || user.phone || rawIdentity}`, {
      device: deviceSession.deviceName,
      location: deviceSession.location,
    });

    // ── CloudWatch: structured user login log ────────────────────
    logger.userLog('login', {
      userId: user._id.toString(),
      email: user.email,
      phone: user.phone,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      provider: user.provider || (isEmailIdentity ? 'local' : 'phone'),
      success: true,
      extra: { device: deviceSession.deviceName, location: deviceSession.location },
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: userResponse,
      accessToken,
      refreshToken,
      cachedImage, // { url, name, cachedAt } or null
    });

    // ✅ NON-BLOCKING via RabbitMQ: login notification + audit log
    publishLoginNotificationEmail({
      email: user.email,
      username: user.name,
      loginDetails: {
        device: deviceSession.deviceName,
        browser: deviceSession.browser || 'Unknown',
        os: deviceSession.os || 'Unknown',
        ip: req.ip,
        location: deviceSession.location,
        time: new Date().toISOString(),
      },
    }).catch(() => {});

    publishAuditLog({
      userId: user._id.toString(),
      action: 'login',
      email: user.email,
      phone: user.phone,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        device: deviceSession.deviceName,
        provider: user.provider || (isEmailIdentity ? 'local' : 'phone'),
        location: deviceSession.location,
      },
    }).catch(() => {});
  } catch (error) {
    logger.error("❌ Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ==================== UPDATED: GOOGLE LOGIN WITH DEVICE TRACKING ====================
exports.googleTokenAuth = async (req, res) => {
  try {
    const { token: googleToken, idToken, accessToken: googleAccessToken } = req.body;

    // Accept token from web OR idToken from mobile (React Native Google Sign-In)
    const resolvedToken = googleToken || idToken || googleAccessToken;

    if (!resolvedToken) {
      return res.status(400).json({
        success: false,
        message: "Google token is required",
      });
    }

    const { user, isNew } = await handleGoogleAuth(resolvedToken, req);

    // Upload Google profile picture to S3 if the user doesn't already have one
    if (user.googleProfileImage && !user.profileImage) {
      try {
        const uploadResult = await s3Service.uploadRemoteProfileImage(
          user.googleProfileImage,
          user._id.toString(),
        );
        if (uploadResult?.imageUrl) {
          user.profileImage = uploadResult.imageUrl;
          user.profileImageKey = uploadResult.key;
          await user.save();
          logger.info('✅ Google profile image uploaded to S3', { userId: user._id });
        }
      } catch (imgErr) {
        logger.warn('Could not upload Google profile image to S3:', imgErr.message);
      }
    }

    // Generate tokens (pass req for fingerprint binding)
    const accessToken = generateAccessToken(user._id, req);
    const refreshToken = generateRefreshToken(user._id);
    const decoded = jwt.decode(refreshToken);

    // Create device session
    const deviceSession = await deviceService.createDeviceSession(req, decoded.jti);

    // Update user devices
    await user.updateDeviceSession(deviceSession, decoded.jti);

    // Add to login history
    await user.addLoginHistory({
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      deviceId: deviceSession.deviceId,
      deviceName: deviceSession.deviceName,
      location: deviceSession.location,
      loginType: "google",
      success: true,
    });

    // Store tokens in Redis
    const stored = await storeRefreshToken(user._id.toString(), refreshToken, req);
    if (!stored) {
      logger.error('Failed to store refresh token in Redis', { userId: user._id });
      clearTokenCookies(res);
      return res.status(503).json({
        success: false,
        message: 'Authentication service temporarily unavailable. Please try again.',
      });
    }
    setTokenCookies(res, accessToken, refreshToken);

    const message = isNew
      ? "Account created with Google"
      : "Google login successful";
    const statusCode = isNew ? 201 : 200;

    const profileImageUrl = s3Service.toProxyUrl(
      user.getProfileImage ? user.getProfileImage() : 
      (user.profileImage || user.googleProfileImage || user.avatar || null)
    );

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      provider: user.provider,
      avatar: user.avatar,
      profileImage: s3Service.toProxyUrl(user.profileImage) || null,
      profileImageKey: user.profileImageKey || null,
      googleProfileImage: user.googleProfileImage || null,
      isVerified: user.isVerified,
      profileImageUrl: profileImageUrl,
      devices: user.devices.map((d) => deviceService.formatDeviceForDisplay(d)),
      currentDevice: deviceService.formatDeviceForDisplay(deviceSession),
    };

    // Check Redis image cache — if user logged out earlier, their image is here
    let cachedImage = null;
    try {
      const cached = await RedisService.getCachedProfileImage(user.email);
      if (cached?.url) {
        cachedImage = cached;
      }
    } catch (_) { /* non-critical */ }

    logger.info(`✅ Google login successful for: ${user.email}`, {
      device: deviceSession.deviceName,
      location: deviceSession.location,
      isNew,
    });

    // ── CloudWatch: structured Google login log ──────────────────
    logger.userLog('login', {
      userId: user._id.toString(),
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      provider: 'google',
      success: true,
      extra: { device: deviceSession.deviceName, location: deviceSession.location, isNew },
    });

    res.status(statusCode).json({
      success: true,
      message,
      user: userResponse,
      accessToken,
      refreshToken,
      cachedImage, // { url, name, cachedAt } or null
    });
  } catch (error) {
    logger.error("❌ Google Token Auth Error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid Google token",
    });
  }
};

// ==================== UPDATED: LOGOUT WITH DEVICE CLEANUP + IMAGE CACHING ====================
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (refreshToken) {
      const decoded = jwt.decode(refreshToken);

      // Deactivate session & cache profile image before clearing
      if (decoded?.id) {
        const user = await User.findById(decoded.id);
        if (user) {
          await user.deactivateSession(decoded.jti);

          // Cache the user's current profile image in Redis (survives logout)
          const imageUrl = s3Service.toProxyUrl(
            user.getProfileImage
              ? user.getProfileImage()
              : user.profileImage || user.googleProfileImage || user.avatar || null
          );
          if (imageUrl && user.email) {
            await RedisService.cacheProfileImage(user.email, {
              url: imageUrl,
              name: user.name,
            });
          }
        }
      }

      // Revoke from Redis
      await revokeRefreshToken(refreshToken);
    }

    clearTokenCookies(res);

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });

    // ── CloudWatch: structured logout log ────────────────────────
    logger.userLog('logout', {
      userId: req.user?._id?.toString() || 'unknown',
      ip: req.ip,
      userAgent: req.get('user-agent'),
      success: true,
    });
  } catch (error) {
    logger.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Error during logout",
    });
  }
};

// ==================== UPDATED: LOGOUT ALL DEVICES ====================
exports.logoutAll = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all session token IDs for user
    const redis = require("../config/redis");
    const tokenIds = await redis.smembers(`user_sessions:${userId}`);

    // Deactivate all sessions in user document
    const user = await User.findById(userId);
    if (user) {
      user.devices.forEach((device) => {
        device.sessions.forEach((session) => {
          session.isActive = false;
          session.logoutTime = new Date();
        });
      });
      await user.save();
    }

    // Revoke all tokens from Redis
    await revokeAllUserTokens(userId);

    // Clear cookie
    clearTokenCookies(res);

    res.status(200).json({
      success: true,
      message: "Logged out from all devices successfully",
    });
  } catch (error) {
    logger.error("Logout all error:", error);
    res.status(500).json({
      success: false,
      message: "Error during logout",
    });
  }
};

// ==================== UPLOAD PROFILE IMAGE TO S3 ====================
exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    // Validate image
    const validation = s3Service.validateImage(req.file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const userId = req.user.id;

    // Upload to S3
    const uploadResult = await s3Service.uploadProfileImage(
      req.file.buffer,
      userId,
      req.file.mimetype,
    );

    // Atomic DB update with retry — resilient to brief MongoDB disconnects
    let user;
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        user = await User.findByIdAndUpdate(
          userId,
          {
            $set: {
              profileImage: uploadResult.imageUrl,
              profileImageKey: uploadResult.key,
              profileImageThumbnail: uploadResult.imageUrl,
              updatedAt: new Date(),
            },
          },
          { returnDocument: 'after' }
        );
        break; // success
      } catch (dbError) {
        if (attempt === maxRetries) {
          logger.error("❌ Failed to update profile image in DB after retries:", dbError);
          // S3 upload succeeded but DB save failed — return the image URL
          // so the client at least has it; next upload will still work.
          return res.status(500).json({
            success: false,
            message: "Image uploaded to storage but failed to update profile. Please try again.",
            imageUrl: uploadResult.imageUrl,
          });
        }
        logger.warn(`DB save attempt ${attempt} failed, retrying...`, dbError.message);
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }

    // Log activity (non-critical)
    try {
      await user.addSecurityLog(
        "profile_image_updated",
        req.ip,
        req.get("user-agent"),
        { imageKey: uploadResult.key },
      );
    } catch (_) { /* non-critical */ }

    const profileImageUrl = getResolvedProfileImage(user);

    // Update Redis image cache with the proxy URL
    try {
      await RedisService.cacheProfileImage(user.email, {
        url: s3Service.toProxyUrl(uploadResult.imageUrl),
        name: user.name,
      });
    } catch (_) { /* non-critical */ }

    await invalidateAccountCaches(userId);

    res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      imageUrl: s3Service.toProxyUrl(uploadResult.imageUrl),
      imageKey: uploadResult.key,
      user: {
        ...user.toJSON(),
        profileImage: s3Service.toProxyUrl(uploadResult.imageUrl),
        profileImageUrl: profileImageUrl,
        updatedAt: user.updatedAt,
      }
    });
  } catch (error) {
    logger.error("❌ Profile image upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload profile image",
    });
  }
};

// ==================== GENERATE UPLOAD URL FOR CLIENT-SIDE UPLOAD ====================
exports.generateUploadUrl = async (req, res) => {
  try {
    const { fileType } = req.body;
    const userId = req.user.id;

    if (!fileType || !fileType.startsWith("image/")) {
      return res.status(400).json({
        success: false,
        message: "Valid image file type is required",
      });
    }

    const uploadData = await s3Service.generateUploadUrl(userId, fileType);

    res.status(200).json({
      success: true,
      ...uploadData,
    });
  } catch (error) {
    logger.error("❌ Generate upload URL error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate upload URL",
    });
  }
};

// ==================== GET USER DEVICES ====================
exports.getUserDevices = async (req, res) => {
  try {
    const cacheKey = `devices:${req.user.id}`;
    const cached = await readJsonCache(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const user = await User.findById(req.user.id);

    const formattedDevices = user.devices.map((device) =>
      deviceService.formatDeviceForDisplay(device),
    );

    // Get current device from refresh token
    const { refreshToken } = req.cookies;
    let currentDeviceId = null;

    if (refreshToken) {
      const decoded = jwt.decode(refreshToken);
      if (decoded?.jti) {
        const currentSession = user.devices.find((d) =>
          d.sessions.some((s) => s.tokenId === decoded.jti),
        );
        currentDeviceId = currentSession?.deviceId;
      }
    }

    const payload = {
      success: true,
      devices: formattedDevices,
      currentDeviceId,
    };

    await writeJsonCache(cacheKey, payload, DEVICES_CACHE_TTL_SECONDS);

    res.status(200).json(payload);
  } catch (error) {
    logger.error("❌ Get user devices error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get devices",
    });
  }
};

// ==================== GET LOGIN HISTORY ====================
exports.getLoginHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("loginHistory");

    // Map ISO country codes to display names
    const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

    const history = user.loginHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((log) => {
        let location = "Unknown";
        let timezone = null;

        // Try stored location first, fall back to IP lookup for old entries
        let loc = log.location;
        if ((!loc || (!loc.city && !loc.country)) && log.ipAddress) {
          loc = deviceService.getLocationFromIP(log.ipAddress);
        }

        if (loc) {
          const city = loc.city || "";
          const region = loc.region || "";
          let country = loc.country || "";
          timezone = loc.timezone || null;
          // Convert ISO code (IN, US) to full name (India, United States)
          if (country && country.length === 2) {
            try { country = countryNames.of(country) || country; } catch (_) { /* keep code */ }
          }
          const parts = [city, region, country].filter(
            (p) => p && p !== "Local" && p !== "Development"
          );
          location = parts.length > 0 ? parts.join(", ") : "Local Network";
        }

        return {
          timestamp: log.timestamp,
          ipAddress: log.ipAddress,
          location,
          timezone,
          deviceName: log.deviceName || "Unknown Device",
          loginType: log.loginType,
          success: log.success,
          failureReason: log.failureReason,
        };
      });

    res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    logger.error("❌ Get login history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get login history",
    });
  }
};

// ==================== GET USER ACTIVITY LOG ====================
exports.getActivityLog = async (req, res) => {
  try {
    const cacheKey = `activity:${req.user.id}`;
    const cached = await readJsonCache(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const user = await User.findById(req.user.id).select("loginHistory securityLogs");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const loginEvents = (user.loginHistory || []).map((entry) => ({
      id: `login-${entry._id || entry.timestamp?.getTime?.() || Math.random()}`,
      type: entry.success ? 'login' : 'login-failed',
      title: entry.success ? 'Signed in' : 'Failed sign-in attempt',
      description: entry.success
        ? `${entry.deviceName || 'Unknown device'}${entry.location?.city || entry.location?.country ? ` from ${[entry.location?.city, entry.location?.country].filter(Boolean).join(', ')}` : ''}`
        : entry.failureReason || 'Login attempt failed',
      timestamp: entry.timestamp,
      metadata: {
        ipAddress: entry.ipAddress,
        deviceName: entry.deviceName,
        loginType: entry.loginType,
        success: entry.success,
      },
    }));

    const securityEvents = (user.securityLogs || []).map((entry) => ({
      id: `security-${entry._id || entry.timestamp?.getTime?.() || Math.random()}`,
      type: entry.action || 'security',
      title:
        entry.action === 'profile_updated'
          ? 'Updated profile details'
          : entry.action === 'profile_image_updated'
            ? 'Changed profile image'
            : entry.action === 'password_changed'
              ? 'Changed password'
              : entry.action === 'failed_login'
                ? 'Security alert'
                : 'Security activity',
      description:
        entry.action === 'profile_updated'
          ? 'Your account profile information was updated.'
          : entry.action === 'profile_image_updated'
            ? 'Your dashboard avatar was changed.'
            : entry.action === 'password_changed'
              ? 'Your password was updated successfully.'
              : entry.details?.reason || 'A security-related action was recorded.',
      timestamp: entry.timestamp,
      metadata: entry.details || {},
    }));

    const activity = [...loginEvents, ...securityEvents]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 100);

    const payload = {
      success: true,
      summary: {
        totalActions: activity.length,
        successfulLogins: loginEvents.filter((entry) => entry.type === 'login').length,
        securityEvents: securityEvents.length,
      },
      activity,
    };

    await writeJsonCache(cacheKey, payload, ACTIVITY_CACHE_TTL_SECONDS);

    res.status(200).json(payload);
  } catch (error) {
    logger.error("❌ Get activity log error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get activity log",
    });
  }
};

// ==================== REVOKE DEVICE ====================
exports.revokeDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);

    const device = user.devices.find((d) => d.deviceId === deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found",
      });
    }

    // Check if trying to revoke current device
    const { refreshToken } = req.cookies;
    if (refreshToken) {
      const decoded = jwt.decode(refreshToken);
      if (decoded?.jti) {
        const isCurrent = device.sessions.some(
          (s) => s.tokenId === decoded.jti,
        );
        if (isCurrent) {
          return res.status(400).json({
            success: false,
            message: "Cannot revoke current device. Use logout instead.",
          });
        }
      }
    }

    // Revoke all sessions for this device
    for (const session of device.sessions) {
      if (session.tokenId) {
        await revokeRefreshTokenByJti(session.tokenId);
      }
    }

    // Remove device
    user.devices = user.devices.filter((d) => d.deviceId !== deviceId);
    await user.save();

    await invalidateAccountCaches(userId);

    logger.info("✅ Device revoked", { userId, deviceId });

    res.status(200).json({
      success: true,
      message: "Device revoked successfully",
    });
  } catch (error) {
    logger.error("❌ Revoke device error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to revoke device",
    });
  }
};

// ==================== GET GOOGLE CLIENT ID ====================
exports.getGoogleClientId = (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      return res.status(500).json({
        success: false,
        message: "Google authentication is not configured on the server",
      });
    }

    res.status(200).json({
      success: true,
      clientId: clientId,
    });
  } catch (error) {
    logger.error("Get Google client ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ==================== REGISTRATION METHODS ====================
exports.initiateRegister = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    logger.info("🔍 Registration attempt:", { email: normalizedEmail, name });

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "All fields are required: name, email, password",
      });
    }

    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    const passwordValidation = await passwordSecurity.validatePassword(
      password,
      null,
      true,
    );

    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Password does not meet security requirements",
        errors: passwordValidation.errors,
        strength: passwordValidation.strength,
      });
    }

    // No confirmPassword check needed

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists. Please sign in.",
      });
    }

    const pendingRegistration =
      await RedisService.getPendingRegistration(normalizedEmail);
    if (pendingRegistration) {
      const now = new Date();
      const createdAt = new Date(pendingRegistration.createdAt);
      const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);

      if (now < expiresAt) {
        // Resend OTP instead of silently returning
        const lastResendTime = pendingRegistration.lastResendTime;
        if (lastResendTime) {
          const timeSinceLastResend = (now - new Date(lastResendTime)) / 1000;
          if (timeSinceLastResend < 60) {
            return res.status(200).json({
              success: true,
              message: "OTP sent to your email. Please verify to complete registration.",
              email: normalizedEmail,
              expiresIn: Math.ceil((expiresAt - now) / 1000),
            });
          }
        }

        const newOtp = OTPGenerator.generateOTP();
        await RedisService.storeOTP(normalizedEmail, newOtp);
        pendingRegistration.lastResendTime = now.toISOString();
        pendingRegistration.resendCount = (pendingRegistration.resendCount || 0) + 1;
        await RedisService.storePendingRegistration(normalizedEmail, pendingRegistration);

        logger.info(`📤 Re-queuing OTP email for pending registration: ${normalizedEmail}`);
        const otpQueued = await publishOTPEmail({ email: normalizedEmail, username: pendingRegistration.name, otp: newOtp, type: 'registration' });
        if (!otpQueued) {
          try {
            await EmailService.sendOTPEmail(normalizedEmail, pendingRegistration.name, newOtp);
            logger.info(`✅ OTP re-sent directly (queue fallback) to ${normalizedEmail}`);
          } catch (emailError) {
            logger.error("❌ Failed to resend OTP email:", emailError.message);
          }
        }

        return res.status(200).json({
          success: true,
          message: "OTP sent to your email. Please verify to complete registration.",
          email: normalizedEmail,
          expiresIn: Math.ceil((expiresAt - now) / 1000),
        });
      } else {
        await RedisService.deletePendingRegistration(normalizedEmail);
      }
    }

    const emailBlocked = await RedisService.checkEmailBlocked(normalizedEmail);
    if (emailBlocked) {
      return res.status(429).json({
        success: false,
        message: "Too many registration attempts. Please try again in 1 hour.",
      });
    }

    const otp = OTPGenerator.generateOTP();
    logger.info(`✅ Generated OTP for ${normalizedEmail}`);

    const hashedPassword = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const userData = {
      name,
      email: normalizedEmail,
      password: hashedPassword,
      provider: "local",
      otpAttempts: 0,
      resendCount: 0,
      createdAt: new Date().toISOString(),
      lastResendTime: null,
      passwordStrength: passwordValidation.strength,
      breachChecked: passwordValidation.breach,
    };

    const storeResult = await RedisService.storePendingRegistration(
      normalizedEmail,
      userData,
    );
    if (!storeResult) {
      throw new Error("Failed to store registration data");
    }

    const otpStoreResult = await RedisService.storeOTP(normalizedEmail, otp);
    if (!otpStoreResult) {
      throw new Error("Failed to store OTP");
    }

    await RedisService.incrementRegistrationAttempts(normalizedEmail);

    // ✅ NON-BLOCKING: publish OTP to RabbitMQ queue — API responds immediately
    logger.info(`📤 Queuing OTP email for: ${normalizedEmail}`);
    const otpQueued = await publishOTPEmail({ email: normalizedEmail, username: name, otp, type: 'registration' });
    
    // Fallback: if queue unavailable, send directly (blocking) to avoid silent failure
    if (!otpQueued) {
      try {
        await EmailService.sendOTPEmail(normalizedEmail, name, otp);
        logger.info(`✅ OTP sent directly (queue fallback) to ${normalizedEmail}`);
      } catch (emailError) {
        logger.error("❌ Failed to send OTP email (direct fallback):", emailError.message);
        await RedisService.deletePendingRegistration(normalizedEmail);
        await RedisService.deleteOTP(normalizedEmail);
        return res.status(500).json({
          success: false,
          message: "Failed to send OTP email. Please try again later.",
        });
      }
    }

    // Audit log (fire-and-forget via queue)
    publishAuditLog({
      action: 'otp_requested',
      email: normalizedEmail,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { type: 'registration' },
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message:
        "OTP sent to your email. Please verify to complete registration.",
      email: normalizedEmail,
      expiresIn: 600,
    });
  } catch (error) {
    logger.error("❌ Registration initiation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.verifyOTPAndRegister = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const otpBlocked = await RedisService.checkOTPBlocked(email);
    if (otpBlocked.blocked) {
      return res.status(429).json({
        success: false,
        message: `Too many failed attempts. Please try again in ${otpBlocked.remainingSeconds} seconds.`,
        blocked: true,
        remainingSeconds: otpBlocked.remainingSeconds,
      });
    }

    const pendingData = await RedisService.getPendingRegistration(email);
    if (!pendingData) {
      return res.status(400).json({
        success: false,
        message:
          "Registration session expired or not found. Please start over.",
      });
    }

    const otpVerification = await RedisService.verifyOTP(email, otp);
    if (!otpVerification.valid) {
      const attemptResult = await RedisService.incrementOTPAttempts(email, {
        userId: pendingData.userId || null,
        userName: pendingData.name || null,
        context: "registration",
      });

      let errorMessage =
        otpVerification.reason || "Invalid OTP. Please try again.";

      if (attemptResult.blocked) {
        errorMessage = `Too many failed attempts. Please try again in 60 seconds.`;
        return res.status(429).json({
          success: false,
          message: errorMessage,
          blocked: true,
          remainingSeconds: 60,
          attempts: attemptResult.attempts,
        });
      }

      const attemptsRemaining = 3 - attemptResult.attempts;
      return res.status(400).json({
        success: false,
        message: errorMessage,
        attemptsRemaining: attemptsRemaining,
        attempts: attemptResult.attempts,
      });
    }

    await RedisService.clearOTPAttempts(email);
    await RedisService.clearOTPBlock(email);

    const userExists = await User.findOne({ email });
    if (userExists) {
      await RedisService.deletePendingRegistration(email);
      return res.status(400).json({
        success: false,
        message: "User already registered. Please login.",
      });
    }

    const user = new User({
      name: pendingData.name,
      email: pendingData.email,
      password: pendingData.password,
      provider: "local",
      isVerified: true,
      lastPasswordChange: new Date(),
    });

    user.passwordHistory = [
      {
        password: pendingData.password,
        changedAt: new Date(),
        changedBy: "user",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      },
    ];

    await user.save();

    logger.info(`✅ User created in database: ${email}`);

    logger.userLog('register', {
      userId: user._id.toString(),
      email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      provider: 'local',
      success: true,
    });

    // ✅ NON-BLOCKING: send welcome email via queue
    publishWelcomeEmail({ email, username: user.name, userId: user._id.toString() }).catch(() => {});

    // ✅ NON-BLOCKING: store audit log via queue (persists to MongoDB)
    publishAuditLog({
      userId: user._id.toString(),
      action: 'register',
      email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { provider: 'local' },
    }).catch(() => {});

    await RedisService.deletePendingRegistration(email);

    return await sendTokenResponse(
      user,
      201,
      res,
      "User registered successfully",
    );
  } catch (error) {
    logger.error("❌ OTP verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

// ==================== REFRESH TOKEN ====================
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "No refresh token provided",
        code: "NO_REFRESH_TOKEN",
      });
    }

    const result = await refreshTokens(refreshToken, req);

    // Token is genuinely invalid / expired → clear cookies
    if (result.error === 'invalid') {
      clearTokenCookies(res);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
        code: "INVALID_REFRESH_TOKEN",
      });
    }

    // Transient failure (Redis/network blip) → DON'T clear cookies!
    // The token is probably still valid. Let the client retry.
    if (result.error === 'transient') {
      return res.status(503).json({
        success: false,
        message: "Token service temporarily unavailable. Please retry.",
        code: "SERVICE_UNAVAILABLE",
      });
    }

    setTokenCookies(res, result.tokens.accessToken, result.tokens.refreshToken);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
    });
  } catch (error) {
    logger.error("Refresh token error:", error);
    // DON'T clear cookies on server errors — the session may still be valid
    res.status(500).json({
      success: false,
      message: "Server error during token refresh",
      code: "SERVER_ERROR",
    });
  }
};

// ==================== CHECK AUTH ====================
exports.checkAuth = async (req, res) => {
  try {
    const { accessToken } = req.cookies;

    if (!accessToken) {
      // The access token cookie may have expired (15 min maxAge) while
      // the refresh token (7 days, path=/api/auth) is still valid.
      // Return ACCESS_TOKEN_EXPIRED so the client keeps the persisted
      // user state and triggers a refresh instead of logging out.
      return res.status(200).json({
        success: true,
        isAuthenticated: false,
        code: 'ACCESS_TOKEN_EXPIRED',
      });
    }

    // Step 1: verify the JWT (pure crypto, no DB)
    let decoded;
    try {
      decoded = jwt.verify(
        accessToken,
        process.env.JWT_ACCESS_SECRET,
      );
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        // Access token expired — DON'T try to refresh here.
        // Let the client-side interceptor call /api/auth/refresh
        // (which uses the SETNX-locked tokenUtils.refreshTokens).
        // Returning isAuthenticated:false with code so the client
        // knows it can retry after refreshing.
        return res.status(200).json({
          success: true,
          isAuthenticated: false,
          code: "ACCESS_TOKEN_EXPIRED",
        });
      }
      // Invalid / malformed token
      return res.status(200).json({
        success: true,
        isAuthenticated: false,
      });
    }

    if (decoded.type !== "access") {
      return res.status(200).json({
        success: true,
        isAuthenticated: false,
      });
    }

    // --- Step 2: fetch user from DB (lightweight select for performance) ---
    let user;
    try {
      user = await User.findById(decoded.id).select(
        'name email role provider status profileImage googleProfileImage avatar isVerified passwordNeedsChange'
      );
    } catch (dbError) {
      // MongoDB is temporarily down — return 503 so the client
      // does NOT clear the session.  The user stays logged in
      // and simply retries on the next check.
      logger.warn("checkAuth: MongoDB unreachable, keeping session", {
        error: dbError.message,
      });
      return res.status(503).json({
        success: false,
        message: "Database temporarily unavailable",
        code: "DB_UNAVAILABLE",
      });
    }

    if (!user) {
      return res.status(200).json({
        success: true,
        isAuthenticated: false,
      });
    }

    // --- Step 3: verify active session exists in Upstash Redis ---
    // NOTE: This is a soft check — JWT + MongoDB already verified the user.
    // If Redis session data is stale or missing (e.g. after MongoDB reconnect,
    // token rotation edge case), we still trust the valid access token.
    // The session info is added to the response for client-side awareness.
    let redisSessionValid = true;
    try {
      const redis = require("../config/redis");
      const sessionTokenIds = await redis.smembers(`user_sessions:${decoded.id}`);

      if (!sessionTokenIds || sessionTokenIds.length === 0) {
        logger.info("checkAuth: No active sessions in Redis for user (soft check)", { userId: decoded.id });
        redisSessionValid = false;
      } else {
        // Verify at least one session still has a valid refresh token (single MGET round-trip)
        const keys = sessionTokenIds.map((id) => `refresh_token:${id}`);
        const results = await redis.mget(...keys);
        const hasValidSession = results.some((r) => r !== null);

        if (!hasValidSession) {
          logger.info("checkAuth: All Redis sessions expired for user (soft check)", { userId: decoded.id });
          redisSessionValid = false;
        }
      }
    } catch (redisError) {
      // Redis temporarily down — don't block authentication.
      logger.warn("checkAuth: Redis check failed, proceeding with JWT+DB only", {
        error: redisError.message,
        userId: decoded.id,
      });
    }

    const passwordExpiration = user.passwordNeedsChange
      ? user.passwordNeedsChange()
      : null;

    const profileImageUrl = s3Service.toProxyUrl(
      user.getProfileImage
        ? user.getProfileImage()
        : user.profileImage || user.googleProfileImage || user.avatar || null
    );

    return res.status(200).json({
      success: true,
      isAuthenticated: true,
      redisSessionValid,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        provider: user.provider,
        avatar: user.avatar,
        profileImage: s3Service.toProxyUrl(user.profileImage) || null,
        profileImageKey: user.profileImageKey,
        googleProfileImage: user.googleProfileImage,
        isVerified: user.isVerified,
        profileImageUrl: profileImageUrl,
        passwordExpiration,
      },
    });
  } catch (error) {
    logger.error("Check auth error:", error);
    // Return 503 (not 500) so the client keeps the session alive
    res.status(503).json({
      success: false,
      message: "Server error",
      code: "SERVER_ERROR",
    });
  }
};

// ==================== GET PROFILE ====================
exports.getProfile = async (req, res) => {
  try {
    const cacheKey = `profile:${req.user.id}`;
    const cached = await readJsonCache(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const user = req.user;

    // Count active listings across all category models
    const listingModels = [
      require("../models/electronics.model"),
      require("../models/vehicle.model"),
      require("../models/mobile.model"),
      require("../models/job.model"),
      require("../models/furniture.model"),
      require("../models/toy.model"),
      require("../models/fashion.model"),
      require("../models/sports.model"),
      require("../models/collectible.model"),
      require("../models/pet.model"),
      require("../models/service.model"),
      require("../models/book.model"),
      require("../models/beauty.model"),
      require("../models/other.model"),
      require("../models/forsale.model"),
      require("../models/event.model"),
      require("../models/property.model"),
      require("../models/takecare.model"),
    ];

    const [passwordProbeUser, followCounts, ...listingCounts] = await Promise.all([
      User.findById(user._id).select("+password"),
      User.aggregate([
        { $match: { _id: user._id } },
        { $project: {
          followersCount: { $size: { $ifNull: ['$followers', []] } },
          followingCount: { $size: { $ifNull: ['$following', []] } },
        }},
      ]),
      ...listingModels.map((Model) =>
        Model.countDocuments({ seller: user._id, status: "active" })
      ),
    ]);
    const hasPassword = !!passwordProbeUser?.password;
    const followersCount = followCounts[0]?.followersCount || 0;
    const followingCount = followCounts[0]?.followingCount || 0;
    const listingsCount = listingCounts.reduce((sum, c) => sum + c, 0);

    const profileImageUrl = getResolvedProfileImage(user);

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      provider: user.provider,
      hasPassword,
      avatar: user.avatar,
      profileImage: s3Service.toProxyUrl(user.profileImage) || null,
      profileImageKey: user.profileImageKey,
      googleProfileImage: user.googleProfileImage,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      phone: user.phone || null,
      address: user.address || null,
      bio: user.bio || null,
      dateOfBirth: user.dateOfBirth || null,
      gender: user.gender || null,
      profileImageUrl: profileImageUrl,
      followersCount,
      followingCount,
      listingsCount,
      preferences: {
        emailNotifications: user.preferences?.emailNotifications ?? true,
        pushNotifications: user.preferences?.pushNotifications ?? true,
        marketingEmails: user.preferences?.marketingEmails ?? false,
        twoFactorAuth: user.preferences?.twoFactorAuth ?? false,
        theme: user.preferences?.theme ?? 'auto',
      },
      passwordExpiration: user.passwordNeedsChange
        ? user.passwordNeedsChange()
        : null,
    };

    const payload = {
      success: true,
      user: userResponse,
    };

    await writeJsonCache(cacheKey, payload, PROFILE_CACHE_TTL_SECONDS);

    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ==================== UPDATE PROFILE ====================
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, phone, address, bio, dateOfBirth, gender } = req.body;
    const updateData = {};

    if (name !== undefined && name !== "") updateData.name = name;
    if (address !== undefined) updateData.address = address; // allow empty string to clear
    if (bio !== undefined) updateData.bio = bio; // allow empty string to clear
    updateData.updatedAt = new Date();

    // Gender normalisation
    if (gender !== undefined && gender !== "") {
      const genderMap = {
        male: "male",
        female: "female",
        other: "other",
        "non-binary": "other",
        nonbinary: "other",
        "prefer not to say": "prefer-not-to-say",
        "prefer-not-to-say": "prefer-not-to-say",
        prefernottosay: "prefer-not-to-say",
      };
      const normalised = genderMap[gender.toLowerCase().trim()];
      if (normalised) {
        updateData.gender = normalised;
      }
    }

    // Phone sanitisation
    if (phone !== undefined && phone !== "") {
      const digits = String(phone).replace(/\D/g, "");
      const cleaned = digits.slice(-10);
      if (cleaned.length !== 10) {
        return res.status(400).json({
          success: false,
          message: "Phone number must be exactly 10 digits",
        });
      }
      updateData.phone = cleaned;
    }

    // Date of birth
    if (dateOfBirth !== undefined && dateOfBirth !== "") {
      const dob = new Date(dateOfBirth);
      if (isNaN(dob.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date of birth",
        });
      }
      if (dob > new Date()) {
        return res.status(400).json({
          success: false,
          message: "Date of birth cannot be in the future",
        });
      }
      updateData.dateOfBirth = dob;
    }

    // Email change — require OTP verification via separate endpoint
    // Direct email changes are not allowed to prevent account takeover
    if (email !== undefined && email !== "" && email !== req.user.email) {
      return res.status(400).json({
        success: false,
        message: "Email changes require verification. Please use the change email option in Settings.",
      });
    }

    const user = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Log activity (non-fatal)
    try {
      await user.addSecurityLog(
        "profile_updated",
        req.ip,
        req.get("user-agent"),
        { updatedFields: Object.keys(updateData) },
      );
    } catch (logErr) {
      logger.warn("Could not log profile update activity:", logErr.message);
    }

    const profileImageUrl = getResolvedProfileImage(user);
    const passwordProbeUser = await User.findById(user._id).select("+password");
    const hasPassword = !!passwordProbeUser?.password;

    // Invalidate review caches so name updates reflect instantly everywhere
    try {
      await invalidateEntityCache("srvcReviewProv");
      await invalidateEntityCache("srvcReviewList");
    } catch (_) { /* bypass cache err */ }

    await invalidateAccountCaches(user._id);

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      address: user.address || null,
      bio: user.bio || null,
      dateOfBirth: user.dateOfBirth || null,
      gender: user.gender || null,
      role: user.role,
      provider: user.provider,
      hasPassword,
      avatar: user.avatar,
      profileImage: s3Service.toProxyUrl(user.profileImage) || null,
      profileImageKey: user.profileImageKey || null,
      googleProfileImage: user.googleProfileImage || null,
      isVerified: user.isVerified,
      profileImageUrl: profileImageUrl,
      updatedAt: user.updatedAt,
    };

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: userResponse,
    });
  } catch (error) {
    logger.error("❌ Update profile error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: errors.join(", "),
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ==================== FIXED: CHANGE PASSWORD with backward compatibility ====================
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword, confirmPassword } = req.body;
    const confirmation = confirmNewPassword ?? confirmPassword;

    logger.debug("Change password request received", { userId: req.user.id });

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current password and new password",
      });
    }

    if (confirmation !== undefined && confirmation !== newPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match",
      });
    }

    // Get user with password field
    const user = await User.findById(req.user.id).select(
      "+password +passwordHistory",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Validate password strength
    const passwordValidation = await passwordSecurity.validatePassword(
      newPassword,
      user._id.toString(),
      true, // Check breach
    );

    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Password does not meet security requirements",
        errors: passwordValidation.errors,
        strength: passwordValidation.strength,
      });
    }

    // Check password history
    const historyCheck = await user.isPasswordInHistory(newPassword);
    if (historyCheck.inHistory) {
      return res.status(400).json({
        success: false,
        message: historyCheck.message || "You have used this password recently. Please choose a different password.",
      });
    }

    // Add current password to history BEFORE changing it
    await user.addToPasswordHistory(currentPassword, {
      changedBy: "user",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Hash new password with Argon2id
    const hashedPassword = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Update user password
    user.password = hashedPassword;
    user.lastPasswordChange = new Date();
    await user.save();

    // Log the activity
    try {
      await user.addSecurityLog(
        "password_changed",
        req.ip,
        req.get("user-agent"),
        { method: "user_change" },
      );
    } catch (logErr) {
      logger.warn("Could not log password change activity:", logErr.message);
    }

    // Revoke all sessions except current one
    await revokeAllUserTokens(user._id.toString());

    logger.info("Password changed successfully", { userId: user._id });

    res.status(200).json({
      success: true,
      message: "Password changed successfully. Please login again with your new password.",
    });
  } catch (error) {
    logger.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password change",
    });
  }
};

// ==================== FORGOT PASSWORD FLOW ====================
exports.initiateForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const genericForgotPasswordResponse = {
      success: true,
      message: "If an account exists for this email, a password reset OTP has been sent.",
    };

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email }).select("+password provider name email phone");

    if (!user) {
      // Return a generic success to prevent account enumeration
      logger.userLog("forgot_password", {
        email,
        ip: req.ip,
        userAgent: req.get("user-agent"),
        success: true,
        reason: "unknown_email_masked",
      });
      return res.status(200).json(genericForgotPasswordResponse);
    }

    const pendingReset = await RedisService.getPendingPasswordReset(email);
    if (pendingReset) {
      const now = new Date();
      const createdAt = new Date(pendingReset.createdAt);
      const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);

      if (now < expiresAt) {
        return res.status(400).json({
          success: false,
          message:
            "Password reset already in progress. Please check your email for OTP.",
          expiresIn: Math.ceil((expiresAt - now) / 1000),
        });
      } else {
        await RedisService.deletePendingPasswordReset(email);
      }
    }

    const emailBlocked = await RedisService.checkEmailBlocked(email);
    if (emailBlocked) {
      return res.status(429).json({
        success: false,
        message:
          "Too many password reset attempts. Please try again in 1 hour.",
      });
    }

    const otp = OTPGenerator.generateOTP();
    logger.info(`✅ Generated password reset OTP for ${email}: ${maskOtp(otp)}`);

    const resetData = {
      userId: user._id.toString(),
      email: user.email,
      username: user.name,
      phone: user.phone || null,
      provider: user.provider || "local",
      otpAttempts: 0,
      resendCount: 0,
      createdAt: new Date().toISOString(),
      lastResendTime: null,
      type: "password_reset",
    };

    const storeResult = await RedisService.storePendingPasswordReset(
      email,
      resetData,
    );
    if (!storeResult) {
      throw new Error("Failed to store password reset data");
    }

    const otpStoreResult = await RedisService.storeOTP(email, otp);
    if (!otpStoreResult) {
      throw new Error("Failed to store OTP");
    }

    await RedisService.incrementRegistrationAttempts(email);

    try {
      logger.info(`📤 Queuing password reset OTP email for: ${email}`);
      const otpQueued = await publishOTPEmail({ email, username: user.name, otp, type: 'forgot_password' });

      // Fallback: if queue unavailable, send directly
      if (!otpQueued) {
        await EmailService.sendForgotPasswordOTPEmail(email, user.name, otp);
        logger.info(`✅ Password reset OTP sent directly (queue fallback) to ${email}`);
      }

      publishAuditLog({
        action: 'forgot_password_otp_requested',
        userId: user._id?.toString(),
        email,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      }).catch(() => {});
    } catch (emailError) {
      logger.error(
        "❌ Failed to send password reset email:",
        emailError.message,
      );

      await RedisService.deletePendingPasswordReset(email);
      await RedisService.deleteOTP(email);

      return res.status(500).json({
        success: false,
        message: "Failed to send password reset OTP. Please try again later.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Password reset OTP sent to your email",
      email: email,
      expiresIn: 600,
    });
  } catch (error) {
    logger.error("❌ Forgot password initiation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ==================== FIXED: verifyForgotPasswordOTP with proper data storage ====================
exports.verifyForgotPasswordOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // SECURITY: never log OTP values
    logger.debug("verifyForgotPasswordOTP called", { email });

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // Check if OTP is blocked
    const otpBlocked = await RedisService.checkOTPBlocked(email);
    if (otpBlocked.blocked) {
      return res.status(429).json({
        success: false,
        message: `Too many failed attempts. Please try again in ${otpBlocked.remainingSeconds} seconds.`,
        blocked: true,
        remainingSeconds: otpBlocked.remainingSeconds,
      });
    }

    // Get pending password reset data
    const pendingData = await RedisService.getPendingPasswordReset(email);
    
    if (!pendingData) {
      return res.status(400).json({
        success: false,
        message: "Password reset session expired or not found. Please start over.",
      });
    }

    // Verify OTP
    const otpVerification = await RedisService.verifyOTP(email, otp);
    
    if (!otpVerification.valid) {
      const attemptResult = await RedisService.incrementOTPAttempts(email, {
        userId: pendingData.userId || null,
        userName: pendingData.username || pendingData.name || null,
        phone: pendingData.phone || null,
        provider: pendingData.provider || "local",
        context: "forgot_password",
      });

      let errorMessage = otpVerification.reason || "Invalid OTP. Please try again.";

      if (attemptResult.blocked) {
        return res.status(429).json({
          success: false,
          message: "Too many failed attempts. Please try again in 60 seconds.",
          blocked: true,
          remainingSeconds: 60,
          attempts: attemptResult.attempts,
        });
      }

      const attemptsRemaining = 3 - attemptResult.attempts;
      return res.status(400).json({
        success: false,
        message: errorMessage,
        attemptsRemaining,
        attempts: attemptResult.attempts,
      });
    }

    // Clear OTP attempts and block
    await RedisService.clearOTPAttempts(email);
    await RedisService.clearOTPBlock(email);

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const redis = require("../config/redis");
    
    // Create a clean data object with all required fields
    const resetData = {
      userId: pendingData.userId,
      email: pendingData.email || email,
      createdAt: new Date().toISOString()
    };

    // Store in Redis with 10 minute expiry
    const stringifiedData = JSON.stringify(resetData);
    
    await redis.setex(
      `reset:${resetToken}`,
      600, // 10 minutes
      stringifiedData
    );

    // Store email separately for verification
    await redis.setex(
      `reset_email:${resetToken}`,
      600,
      email
    );

    // Clean up OTP data
    await RedisService.deleteOTP(email);
    await RedisService.deletePendingPasswordReset(email);

    logger.info("OTP verified for password reset", { email });

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    logger.error("Verify forgot password OTP error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error during OTP verification" 
    });
  }
};

exports.resendForgotPasswordOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const otpBlocked = await RedisService.checkOTPBlocked(email);
    if (otpBlocked.blocked) {
      return res.status(429).json({
        success: false,
        message: `Too many failed attempts. Please try again in ${otpBlocked.remainingSeconds} seconds.`,
        blocked: true,
        remainingSeconds: otpBlocked.remainingSeconds,
      });
    }

    const pendingData = await RedisService.getPendingPasswordReset(email);
    if (!pendingData) {
      return res.status(200).json({
        success: true,
        message: "If that email has a pending reset, a new OTP has been sent.",
      });
    }

    const lastResendTime = pendingData.lastResendTime;
    if (lastResendTime) {
      const timeDiff = (Date.now() - new Date(lastResendTime).getTime()) / 1000;
      if (timeDiff < 60) {
        return res.status(429).json({
          success: false,
          message: "Please wait before requesting another OTP.",
          waitTime: Math.ceil(60 - timeDiff),
        });
      }
    }

    const otp = OTPGenerator.generateOTP();

    pendingData.lastResendTime = new Date().toISOString();
    pendingData.resendCount = (pendingData.resendCount || 0) + 1;

    await RedisService.storePendingPasswordReset(email, pendingData);
    await RedisService.storeOTP(email, otp);
    await RedisService.clearOTPAttempts(email);
    await RedisService.clearOTPBlock(email);

    try {
      logger.info(`📤 Queuing resend password reset OTP for: ${email}`);
      const otpQueued = await publishOTPEmail({ email, username: pendingData.username || email, otp, type: 'forgot_password' });

      if (!otpQueued) {
        await EmailService.sendForgotPasswordOTPEmail(
          email,
          pendingData.username || email,
          otp,
        );
        logger.info(`✅ Resent password reset OTP directly (queue fallback) to ${email}`);
      }
    } catch (emailError) {
      logger.error(
        "❌ Failed to resend password reset email:",
        emailError.message,
      );
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "New OTP sent to your email.",
      email,
    });
  } catch (error) {
    logger.error("❌ Resend forgot password OTP error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// ==================== FIXED: resetPasswordWithToken with proper data handling ====================
exports.resetPasswordWithToken = async (req, res) => {
  try {
    const { resetToken } = req.params;
    const { email, password } = req.body;

    logger.debug("Reset password request received", { email });

    // Basic validation
    if (!resetToken) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    // Get Redis instance
    const redis = require("../config/redis");
    
    // Check Redis connection
    try {
      await redis.ping();
    } catch (redisError) {
      logger.error("Redis connection failed during password reset:", redisError);
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    // Get data from Redis
    const resetKey = `reset:${resetToken}`;
    const resetEmailKey = `reset_email:${resetToken}`;
    
    const stored = await redis.get(resetKey);
    const storedEmail = await redis.get(resetEmailKey);

    // Parse stored reset data
    let data;
    
    if (!stored) {
      return res.status(400).json({
        success: false,
        message: "Reset token is invalid or has expired.",
      });
    }

    if (typeof stored === 'object' && stored !== null) {
      data = stored;
    } else if (typeof stored === 'string') {
      try {
        if (stored.trim().startsWith('{') || stored.trim().startsWith('[')) {
          data = JSON.parse(stored);
        } else {
          data = { userId: stored };
        }
      } catch (parseError) {
        logger.error("Failed to parse reset data:", parseError.message);
        if (stored.match(/^[0-9a-fA-F]{24}$/)) {
          data = { userId: stored };
        } else {
          return res.status(500).json({
            success: false,
            message: "Invalid stored data format",
          });
        }
      }
    } else {
      logger.error("Unexpected stored data type:", typeof stored);
      return res.status(500).json({
        success: false,
        message: "Invalid stored data format",
      });
    }

    // Validate parsed data
    if (!data || typeof data !== 'object') {
      return res.status(500).json({
        success: false,
        message: "Invalid reset data structure",
      });
    }

    // Extract userId with fallbacks
    const userId = data.userId || data.id || data._id;
    if (!userId) {
      logger.error("Missing userId in reset data");
      return res.status(500).json({
        success: false,
        message: "Invalid reset data - missing user ID",
      });
    }

    // Determine the email to validate against
    const emailToValidate = data.email || storedEmail;
    if (!emailToValidate) {
      return res.status(500).json({
        success: false,
        message: "Invalid reset data - email not found",
      });
    }

    // Validate email
    if (emailToValidate.toLowerCase() !== email.toLowerCase()) {
      logger.warn("Email mismatch during password reset", { userId });
      return res.status(400).json({
        success: false,
        message: "Email does not match the reset token.",
      });
    }

    // Find the user
    const user = await User.findById(userId).select(
      "+password +passwordHistory"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Validate password strength
    const passwordValidation = await passwordSecurity.validatePassword(
      password,
      user._id.toString(),
      true
    );

    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.errors[0] || "Password does not meet security requirements",
        errors: passwordValidation.errors,
        strength: passwordValidation.strength,
      });
    }

    // Check password history
    const historyCheck = await user.isPasswordInHistory(password);
    if (historyCheck.inHistory) {
      return res.status(400).json({
        success: false,
        message: historyCheck.message,
      });
    }

    // Add current password to history only when a password already exists.
    if (user.password) {
      await user.addToPasswordHistory(user.password, {
        changedBy: "reset",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
    }

    // Hash new password with Argon2id
    user.password = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    user.lastPasswordChange = new Date();
    await user.save();

    // Delete the reset token and email mapping from Redis
    await Promise.all([
      redis.del(resetKey),
      redis.del(resetEmailKey)
    ]);

    // Revoke all existing sessions
    await revokeAllUserTokens(user._id.toString());

    // Log the activity
    try {
      await user.addSecurityLog(
        "password_reset",
        req.ip,
        req.get("user-agent"),
        { method: "otp_reset" }
      );
    } catch (logErr) {
      logger.warn("Could not log password reset activity:", logErr.message);
    }

    // Send success email via queue (non-blocking)
    publishPasswordResetSuccessEmail({ email: user.email, username: user.name }).catch((emailErr) => {
      logger.warn("Could not queue reset success email:", emailErr.message);
    });

    publishAuditLog({
      action: 'password_reset_success',
      userId: user._id?.toString(),
      email: user.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }).catch(() => {});

    logger.info("Password reset successfully", { userId: user._id });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    logger.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during password reset",
    });
  }
};


exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const otpBlocked = await RedisService.checkOTPBlocked(email);
    if (otpBlocked.blocked) {
      return res.status(429).json({
        success: false,
        message: `Too many failed attempts. Please try again in ${otpBlocked.remainingSeconds} seconds.`,
        blocked: true,
        remainingSeconds: otpBlocked.remainingSeconds,
      });
    }

    const pendingData = await RedisService.getPendingRegistration(email);
    if (!pendingData) {
      return res.status(400).json({
        success: false,
        message: "No pending registration found for this email.",
      });
    }

    const lastResendTime = pendingData.lastResendTime;
    const now = new Date();

    if (lastResendTime) {
      const timeDiff = (now - new Date(lastResendTime)) / 1000;
      if (timeDiff < 60) {
        return res.status(429).json({
          success: false,
          message: "Please wait before requesting another OTP.",
          waitTime: Math.ceil(60 - timeDiff),
        });
      }
    }

    const otp = OTPGenerator.generateOTP();

    pendingData.lastResendTime = now.toISOString();
    pendingData.resendCount = (pendingData.resendCount || 0) + 1;

    await RedisService.storePendingRegistration(email, pendingData);
    await RedisService.storeOTP(email, otp);

    await RedisService.clearOTPAttempts(email);
    await RedisService.clearOTPBlock(email);

    try {
      logger.info(`📤 Queuing resend OTP for: ${email}`);
      const otpQueued = await publishOTPEmail({ email, username: pendingData.name, otp, type: 'registration' });

      if (!otpQueued) {
        await EmailService.sendOTPEmail(email, pendingData.name, otp);
        logger.info(`✅ Resent OTP directly (queue fallback) to ${email}`);
      }
    } catch (emailError) {
      logger.error("❌ Failed to resend email:", emailError.message);
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP. Please try again later.",
      });
    }

    res.status(200).json({
      success: true,
      message: "New OTP sent to your email.",
      email: email,
    });
  } catch (error) {
    logger.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.checkRegistrationStatus = async (req, res) => {
  try {
    const { email } = req.params;

    const pendingData = await RedisService.getPendingRegistration(email);
    if (!pendingData) {
      // Return same shape regardless — prevents email enumeration
      return res.status(200).json({
        success: true,
        message: "If a registration is in progress, please check your email.",
      });
    }

    const createdAt = new Date(pendingData.createdAt);
    const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
    const now = new Date();
    const expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000));

    res.status(200).json({
      success: true,
      message: "If a registration is in progress, please check your email.",
      data: {
        expiresIn,
      },
    });
  } catch (error) {
    logger.error("Check registration status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.checkPasswordExpiration = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const expirationStatus = user.passwordNeedsChange
      ? user.passwordNeedsChange()
      : {
          needsChange: false,
          daysRemaining: null,
        };

    res.status(200).json({
      success: true,
      expiration: expirationStatus,
    });
  } catch (error) {
    logger.error("❌ Check password expiration error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getPasswordRequirements = (req, res) => {
  const requirements = passwordSecurity.getPasswordRequirements();
  res.status(200).json({
    success: true,
    requirements,
  });
};

exports.setupPassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    const authenticatedUserId = req.user?.id || req.user?._id;

    if (!authenticatedUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await User.findById(authenticatedUserId).select("+password");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      logger.warn("setupPassword ignored mismatched request email", {
        userId: user._id,
        requestedEmail: email,
      });
    }

    if (user.password) {
      return res.status(400).json({
        success: false,
        message: "Password already set. Use change password instead.",
      });
    }

    // Validate password strength
    const passwordValidation = await passwordSecurity.validatePassword(
      password,
      null,
      true,
    );

    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Password does not meet security requirements",
        errors: passwordValidation.errors,
      });
    }

    user.password = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    user.provider = "local";
    user.lastPasswordChange = new Date();
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Password set up successfully." });
  } catch (error) {
    logger.error("Setup password error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  // DEPRECATED: This legacy endpoint is superseded by initiateForgotPassword
  // which uses OTP-based reset.
  return res.status(410).json({
    success: false,
    message: "This endpoint is deprecated. Please use the OTP-based password reset flow.",
    code: "DEPRECATED",
  });
};

exports.resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.resetToken)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+password +passwordHistory");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Reset token is invalid or has expired.",
      });
    }

    // SECURITY: validate password strength even on legacy route
    const passwordValidation = await passwordSecurity.validatePassword(
      req.body.password,
      user._id.toString(),
      true,
    );
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Password does not meet security requirements",
        errors: passwordValidation.errors,
      });
    }

    // SECURITY: check password history
    const historyCheck = await user.isPasswordInHistory(req.body.password);
    if (historyCheck && historyCheck.inHistory) {
      return res.status(400).json({
        success: false,
        message: historyCheck.message || "You have used this password recently.",
      });
    }

    // Add current password to history
    if (user.password && user.addToPasswordHistory) {
      await user.addToPasswordHistory(user.password, {
        changedBy: "legacy_reset",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
    }

    user.password = await argon2.hash(req.body.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.lastPasswordChange = new Date();
    await user.save();

    // Revoke all sessions on password reset
    await revokeAllUserTokens(user._id.toString());

    return res.status(200).json({
      success: true,
      message: "Password reset successfully.",
    });
  } catch (error) {
    logger.error("Legacy reset password error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    const passwordValidation = await passwordSecurity.validatePassword(
      password,
      null,
      true,
    );

    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Password does not meet security requirements",
        errors: passwordValidation.errors,
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "Registration failed. Please check your information and try again.",
      });
    }

    const normalizedPhone = phone ? TwilioService.normalizePhone(String(phone).trim()) : null;

    const user = await User.create({
      name,
      email,
      password,
      phone: normalizedPhone,
      provider: "local",
    });

    await sendTokenResponse(user, 201, res, "User registered successfully");
  } catch (error) {
    logger.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ==================== LEGACY HELPERS ====================
// DEPRECATED: Legacy token generation uses a single shared secret.
// New code should use generateAccessToken/generateRefreshToken with
// dedicated JWT_ACCESS_SECRET / JWT_REFRESH_SECRET.
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required for legacy token generation');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

const legacySendTokenResponse = (user, statusCode, res, message) => {
  const token = generateToken(user._id);

  const profileImageUrl = user.getProfileImage ? user.getProfileImage() : 
                         (user.profileImage || user.googleProfileImage || user.avatar || null);

  const userResponse = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    provider: user.provider,
    avatar: user.avatar,
    profileImage: user.profileImage || null,
    profileImageKey: user.profileImageKey || null,
    googleProfileImage: user.googleProfileImage || null,
    isVerified: user.isVerified,
    profileImageUrl: profileImageUrl,
  };

  res.status(statusCode).json({
    success: true,
    message,
    user: userResponse,
  });
};

exports.generateToken = generateToken;
exports.sendTokenResponse = legacySendTokenResponse;

// ==================== FOLLOW / UNFOLLOW ====================
exports.toggleFollow = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = String(req.user._id || req.user.id);

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({ success: false, message: "You cannot follow yourself" });
    }

    const currentOid = new mongoose.Types.ObjectId(currentUserId);
    const targetOid = new mongoose.Types.ObjectId(targetUserId);

    const targetUser = await User.findById(targetOid).select("_id name");
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const unfollowResult = await User.updateOne(
      { _id: targetOid, followers: currentOid },
      { $pull: { followers: currentOid } },
    );

    let isFollowingNow;

    if (unfollowResult.modifiedCount > 0) {
      await User.updateOne({ _id: currentOid }, { $pull: { following: targetOid } });
      isFollowingNow = false;
    } else {
      await Promise.all([
        User.updateOne({ _id: targetOid }, { $addToSet: { followers: currentOid } }),
        User.updateOne({ _id: currentOid }, { $addToSet: { following: targetOid } }),
      ]);
      isFollowingNow = true;

      const currentUser = await User.findById(currentOid).select("name").lean();
      await createNotification({
        recipient: targetUserId,
        sender: currentUserId,
        type: "follow",
        message: `${currentUser?.name || "Someone"} started following you`,
      });
    }

    const counts = await User.aggregate([
      {
        $facet: {
          target: [
            { $match: { _id: targetOid } },
            {
              $project: {
                followersCount: { $size: { $ifNull: ["$followers", []] } },
              },
            },
          ],
          current: [
            { $match: { _id: currentOid } },
            {
              $project: {
                followersCount: { $size: { $ifNull: ["$followers", []] } },
                followingCount: { $size: { $ifNull: ["$following", []] } },
              },
            },
          ],
        },
      },
    ]);

    const targetCounts = counts[0]?.target?.[0] || {};
    const currentCounts = counts[0]?.current?.[0] || {};

    // Bust both users' profile caches so follower/following counts reflect immediately
    await Promise.allSettled([
      redis.del(`profile:${currentUserId}`),
      redis.del(`profile:${targetUserId}`),
    ]);

    res.status(200).json({
      success: true,
      isFollowing: isFollowingNow,
      followersCount: targetCounts.followersCount || 0,
      followingCount: currentCounts.followingCount || 0,
      myFollowersCount: currentCounts.followersCount || 0,
    });
  } catch (error) {
    logger.error("Toggle follow error:", error);
    res.status(500).json({ success: false, message: "Failed to toggle follow" });
  }
};

// ==================== GET MY FOLLOWERS / FOLLOWING LIST ====================
exports.getMyFollowers = async (req, res) => {
  try {
    const userId = req.user.id;
    const type = req.query.type || "followers"; // "followers" or "following"

    const user = await User.findById(userId).select("followers following");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const ids = (type === "following" ? user.following : user.followers) || [];

    const followCounts = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(userId) } },
      {
        $project: {
          followersCount: { $size: { $ifNull: ["$followers", []] } },
          followingCount: { $size: { $ifNull: ["$following", []] } },
        },
      },
    ]);
    const followersCount = followCounts[0]?.followersCount || 0;
    const followingCount = followCounts[0]?.followingCount || 0;

    const users = await User.find({ _id: { $in: ids } }).select(
      "name profileImage googleProfileImage avatar provider createdAt"
    );

    const list = users.map((u) => {
      const profileImageUrl = u.getProfileImage
        ? u.getProfileImage()
        : u.profileImage || u.googleProfileImage || u.avatar || null;
      return {
        id: u._id.toString(),
        name: u.name || "User",
        profileImageUrl,
        provider: u.provider,
        createdAt: u.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      type,
      users: list,
      followersCount,
      followingCount,
    });
  } catch (error) {
    logger.error("Get my followers error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch followers" });
  }
};

// ==================== PUBLIC SELLER PROFILE ====================
exports.getSellerProfile = async (req, res) => {
  try {
    const sellerId = req.params.userId;
    const currentUserId = String(req.user?._id || req.user?.id || "");

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const seller = await User.findById(sellerId).select(
      "name email profileImage googleProfileImage avatar provider createdAt"
    );

    if (!seller) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Get follower/following counts without loading the arrays
    const followCounts = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(sellerId) } },
      { $project: {
        followersCount: { $size: { $ifNull: ['$followers', []] } },
        followingCount: { $size: { $ifNull: ['$following', []] } },
      }},
    ]);
    const followersCount = followCounts[0]?.followersCount || 0;
    const followingCount = followCounts[0]?.followingCount || 0;

    const isFollowedByCurrentUser = Boolean(
      currentUserId &&
        mongoose.Types.ObjectId.isValid(currentUserId) &&
        (await User.exists({
          _id: sellerId,
          followers: new mongoose.Types.ObjectId(currentUserId),
        })),
    );

    // Count seller's listings across ALL categories
    const listingModels = [
      require("../models/electronics.model"),
      require("../models/vehicle.model"),
      require("../models/mobile.model"),
      require("../models/job.model"),
      require("../models/furniture.model"),
      require("../models/toy.model"),
      require("../models/fashion.model"),
      require("../models/sports.model"),
      require("../models/collectible.model"),
      require("../models/pet.model"),
      require("../models/book.model"),
      require("../models/beauty.model"),
      require("../models/other.model"),
      require("../models/forsale.model"),
      require("../models/event.model"),
      require("../models/property.model"),
      require("../models/takecare.model"),
    ];

    const counts = await Promise.all(
      listingModels.map((Model) =>
        Model.countDocuments({ seller: sellerId, status: "active" })
      )
    );
    const totalListings = counts.reduce((sum, c) => sum + c, 0);

    const profileImageUrl = seller.getProfileImage ? seller.getProfileImage() : 
      (seller.profileImage || seller.googleProfileImage || seller.avatar || null);

    res.status(200).json({
      success: true,
      seller: {
        id: seller._id,
        _id: seller._id,
        name: seller.name,
        email: seller.email,
        provider: seller.provider,
        profileImageUrl,
        createdAt: seller.createdAt,
        isFollowedByCurrentUser,
        followers: isFollowedByCurrentUser ? [currentUserId] : [],
        followersCount,
        followingCount,
        listingsCount: totalListings,
      },
    });
  } catch (error) {
    logger.error("Get seller profile error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch seller profile" });
  }
};

// ==================== SELLER LISTINGS (public, auth-required) ====================
/**
 * GET /api/auth/seller/:userId/listings
 * Returns all active listings across every category for a given seller.
 */
exports.getSellerListings = async (req, res) => {
  try {
    const sellerId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const categoryModels = [
      { model: require("../models/electronics.model"), type: "electronics" },
      { model: require("../models/vehicle.model"), type: "vehicles" },
      { model: require("../models/mobile.model"), type: "mobiles" },
      { model: require("../models/job.model"), type: "jobs" },
      { model: require("../models/furniture.model"), type: "furniture" },
      { model: require("../models/toy.model"), type: "toys" },
      { model: require("../models/fashion.model"), type: "fashion" },
      { model: require("../models/sports.model"), type: "sports" },
      { model: require("../models/collectible.model"), type: "collectibles" },
      { model: require("../models/pet.model"), type: "pets" },
      { model: require("../models/book.model"), type: "books" },
      { model: require("../models/beauty.model"), type: "beauty" },
      { model: require("../models/other.model"), type: "others" },
      { model: require("../models/forsale.model"), type: "forsale" },
      { model: require("../models/event.model"), type: "events" },
      { model: require("../models/property.model"), type: "properties" },
      { model: require("../models/takecare.model"), type: "takecare" },
    ];

    const results = await Promise.all(
      categoryModels.map(async ({ model: Model, type }) => {
        const docs = await Model.find({ seller: sellerId, status: "active" })
          .sort({ createdAt: -1 })
          .limit(50)
          .select("title price images location condition subcategory category createdAt")
          .lean();
        return docs.map((d) => ({
          ...d,
          _listingType: type,
          images: (d.images || []).map((img) =>
            s3Service.toProxyUrl ? s3Service.toProxyUrl(img) : img
          ),
        }));
      })
    );

    const listings = results
      .flat()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({ success: true, listings });
  } catch (error) {
    logger.error("Get seller listings error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch seller listings" });
  }
};

// ==================== EMAIL CHANGE (OTP-based verification) ====================

/**
 * POST /api/auth/request-email-change
 * Body: { newEmail }
 * Sends OTP to the NEW email. Requires auth.
 */
exports.requestEmailChange = async (req, res) => {
  try {
    const userId = req.user.id;
    const { newEmail } = req.body;

    if (!newEmail || typeof newEmail !== 'string') {
      return res.status(400).json({ success: false, message: "New email is required." });
    }

    const trimmedEmail = newEmail.trim().toLowerCase();

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({ success: false, message: "Invalid email format." });
    }

    // Can't change to the same email
    const currentUser = await User.findById(userId).select('email');
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (currentUser.email === trimmedEmail) {
      return res.status(400).json({ success: false, message: "This is already your current email." });
    }

    // Check if new email is already taken
    const emailExists = await User.findOne({ email: trimmedEmail, _id: { $ne: userId } });
    if (emailExists) {
      // Return generic message to prevent email enumeration
      return res.status(200).json({
        success: true,
        message: "Verification code sent to your new email address.",
      });
    }

    // Rate limit: max 3 email change requests per hour
    const rateLimitKey = `email_change_rate:${userId}`;
    const redis = require('../config/redis');
    const attempts = await redis.incr(rateLimitKey);
    if (attempts === 1) await redis.expire(rateLimitKey, 3600);
    if (attempts > 3) {
      return res.status(429).json({
        success: false,
        message: "Too many email change requests. Please try again later.",
      });
    }

    // Generate and store OTP
    const otp = OTPGenerator.generateOTP();
    const pendingKey = `email_change:${userId}`;
    await redis.setex(pendingKey, 600, JSON.stringify({
      newEmail: trimmedEmail,
      otpHash: crypto.createHash('sha256').update(String(otp)).digest('hex'),
      createdAt: new Date().toISOString(),
    }));

    // Send OTP to the NEW email
    await EmailService.sendOTPEmail(trimmedEmail, currentUser.email.split('@')[0], otp);

    logger.info('Email change OTP sent', { userId, newEmail: trimmedEmail });

    res.status(200).json({
      success: true,
      message: "Verification code sent to your new email address.",
    });
  } catch (error) {
    logger.error("Request email change error:", error);
    res.status(500).json({ success: false, message: "Failed to send verification code." });
  }
};

/**
 * POST /api/auth/verify-email-change
 * Body: { otp }
 * Verifies OTP and updates the email. Requires auth.
 */
exports.verifyEmailChange = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otp } = req.body;

    if (!otp || typeof otp !== 'string') {
      return res.status(400).json({ success: false, message: "Verification code is required." });
    }

    const redis = require('../config/redis');
    const pendingKey = `email_change:${userId}`;
    const pendingRaw = await redis.get(pendingKey);

    if (!pendingRaw) {
      return res.status(400).json({
        success: false,
        message: "No pending email change found. Please request a new verification code.",
      });
    }

    const pending = typeof pendingRaw === 'string' ? JSON.parse(pendingRaw) : pendingRaw;
    const otpHash = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');

    if (otpHash !== pending.otpHash) {
      return res.status(400).json({ success: false, message: "Invalid verification code." });
    }

    // Double-check email uniqueness at write time (TOCTOU safety)
    const emailTaken = await User.findOne({ email: pending.newEmail, _id: { $ne: userId } });
    if (emailTaken) {
      await redis.del(pendingKey);
      return res.status(400).json({ success: false, message: "This email is no longer available." });
    }

    // Update the email
    const user = await User.findByIdAndUpdate(
      userId,
      { email: pending.newEmail, lastEmailChange: new Date() },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Clean up
    await redis.del(pendingKey);

    // Log the change
    try {
      await user.addSecurityLog('email_changed', req.ip, req.get('user-agent'), {
        oldEmail: req.user.email,
        newEmail: pending.newEmail,
      });
    } catch (_) {}

    logger.info('Email changed successfully', { userId, newEmail: pending.newEmail });

    res.status(200).json({
      success: true,
      message: "Email updated successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error("Verify email change error:", error);
    res.status(500).json({ success: false, message: "Failed to verify email change." });
  }
};

// ==================== PHONE AUTH: SEND OTP ====================
/**
 * POST /api/auth/phone/send-otp
 * Body: { phone: "+919876543210", channel?: "sms" | "whatsapp" }
 * Sends a 6-digit OTP via Twilio SMS or WhatsApp. Stores hashed OTP in Redis.
 */
exports.phoneSendOTP = async (req, res) => {
  try {
    const { phone, channel = "sms" } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }

    if (!["sms", "whatsapp"].includes(channel)) {
      return res.status(400).json({ success: false, message: "Channel must be 'sms' or 'whatsapp'" });
    }

    const normalizedPhone = TwilioService.normalizePhone(phone);
    if (!normalizedPhone || !/^\+\d{7,15}$/.test(normalizedPhone)) {
      return res.status(400).json({ success: false, message: "Invalid phone number format" });
    }

    // Rate-limit: check if phone is blocked
    const phoneKey = normalizedPhone.replace("+", "");
    const blocked = await RedisService.checkEmailBlocked(phoneKey);
    if (blocked) {
      return res.status(429).json({
        success: false,
        message: "Too many OTP requests. Please try again in 1 hour.",
      });
    }

    const otp = OTPGenerator.generateOTP();
    logger.info(`Generated phone OTP for ${normalizedPhone.slice(0, 5)}****`, { channel });

    // Store OTP hashed in Redis (keyed by phone number)
    const otpStored = await RedisService.storeOTP(phoneKey, otp);
    if (!otpStored) {
      return res.status(500).json({ success: false, message: "Failed to generate OTP. Try again." });
    }

    // Send via selected channel
    const sendResult = channel === "whatsapp"
      ? await TwilioService.sendWhatsAppOTP(normalizedPhone, otp)
      : await TwilioService.sendOTP(normalizedPhone, otp);

    if (!sendResult.success) {
      await RedisService.deleteOTP(phoneKey);
      logger.error(`${channel.toUpperCase()} OTP send failed`, { error: sendResult.error });
      return res.status(500).json({
        success: false,
        message: `Failed to send OTP via ${channel === "whatsapp" ? "WhatsApp" : "SMS"}. Please try again.`,
      });
    }

    await RedisService.incrementRegistrationAttempts(phoneKey);

    const channelLabel = channel === "whatsapp" ? "WhatsApp" : "SMS";
    res.status(200).json({
      success: true,
      message: `OTP sent via ${channelLabel} to your phone number.`,
      phone: normalizedPhone.slice(0, 5) + "****" + normalizedPhone.slice(-2),
      channel,
      expiresIn: 300,
    });
  } catch (error) {
    logger.error("Phone send OTP error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==================== PHONE AUTH: VERIFY OTP & LOGIN/REGISTER ====================
/**
 * POST /api/auth/phone/verify-otp
 * Body: { phone: "+919876543210", otp: "123456", name?: "John" }
 * Verifies OTP. If user exists with this phone → login.
 * If user does NOT exist → register new account with phone provider.
 */
exports.phoneVerifyOTP = async (req, res) => {
  try {
    const { phone, otp, name } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required",
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be 6 digits",
      });
    }

    const normalizedPhone = TwilioService.normalizePhone(phone);
    const phoneKey = normalizedPhone.replace("+", "");

    // Verify OTP from Redis
    const otpResult = await RedisService.verifyOTP(phoneKey, otp);

    if (!otpResult.valid) {
      await RedisService.incrementOTPAttempts(phoneKey, {
        ip: req.ip,
        userAgent: req.get("user-agent"),
        phone: normalizedPhone,
      });

      return res.status(400).json({
        success: false,
        message: otpResult.message || "Invalid or expired OTP",
        attemptsRemaining: otpResult.attemptsRemaining,
      });
    }

    // OTP valid — clean up
    await RedisService.deleteOTP(phoneKey);

    // Find existing user by phone
    let user = await User.findOne({ phone: normalizedPhone }).select(
      "+password +devices +loginHistory"
    );
    let isNew = false;

    if (!user) {
      // Register new user with phone
      isNew = true;
      user = new User({
        name: name || "",
        phone: normalizedPhone,
        phoneVerified: true,
        provider: "phone",
        isVerified: true,
        status: "active",
      });
      await user.save();

      logger.info("New phone user registered", { userId: user._id, phone: normalizedPhone.slice(0, 5) + "****" });

      // Reload with selected fields
      user = await User.findById(user._id).select("+devices +loginHistory");
    } else {
      // Existing user — mark phone as verified
      if (!user.phoneVerified) {
        user.phoneVerified = true;
        await user.save();
      }
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id, req);
    const refreshToken = generateRefreshToken(user._id);
    const decoded = jwt.decode(refreshToken);

    // Create device session
    const deviceSession = await deviceService.createDeviceSession(req, decoded.jti);
    await user.updateDeviceSession(deviceSession, decoded.jti);

    // Add login history
    await user.addLoginHistory({
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      deviceId: deviceSession.deviceId,
      deviceName: deviceSession.deviceName,
      location: deviceSession.location,
      loginType: "phone",
      success: true,
    });

    // Store refresh token in Redis
    const stored = await storeRefreshToken(user._id.toString(), refreshToken, req);
    if (!stored) {
      logger.error("Failed to store refresh token in Redis", { userId: user._id });
      clearTokenCookies(res);
      return res.status(503).json({
        success: false,
        message: "Authentication service temporarily unavailable.",
      });
    }

    setTokenCookies(res, accessToken, refreshToken);

    const profileImageUrl = s3Service.toProxyUrl(
      user.getProfileImage ? user.getProfileImage() :
      (user.profileImage || user.googleProfileImage || user.avatar || null)
    );

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email || null,
      phone: user.phone,
      role: user.role,
      provider: user.provider,
      hasPassword: !!user.password,
      avatar: user.avatar,
      profileImage: s3Service.toProxyUrl(user.profileImage) || null,
      profileImageKey: user.profileImageKey || null,
      googleProfileImage: user.googleProfileImage || null,
      isVerified: user.isVerified,
      phoneVerified: user.phoneVerified,
      profileImageUrl,
      devices: user.devices
        ? user.devices.map((d) => deviceService.formatDeviceForDisplay(d))
        : [],
      currentDevice: deviceService.formatDeviceForDisplay(deviceSession),
    };

    const message = isNew
      ? "Account created with phone number"
      : "Phone login successful";
    const statusCode = isNew ? 201 : 200;

    logger.info(`Phone auth successful: ${normalizedPhone.slice(0, 5)}****`, {
      device: deviceSession.deviceName,
      isNew,
    });

    logger.userLog("login", {
      userId: user._id.toString(),
      phone: normalizedPhone,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      provider: "phone",
      success: true,
      extra: { device: deviceSession.deviceName, location: deviceSession.location, isNew },
    });

    res.status(statusCode).json({
      success: true,
      message,
      user: userResponse,
      isNew,
    });

    // Non-blocking audit log
    publishAuditLog({
      userId: user._id.toString(),
      action: isNew ? "phone_register" : "phone_login",
      phone: normalizedPhone,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        device: deviceSession.deviceName,
        provider: "phone",
        location: deviceSession.location,
      },
    }).catch(() => {});
  } catch (error) {
    logger.error("Phone verify OTP error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==================== GOOGLE CLIENT IDs FOR MOBILE ====================
/**
 * GET /api/auth/google/client-ids
 * Returns all configured Google OAuth client IDs (web + iOS + Android)
 * so mobile apps can pick the right one for their platform.
 */
exports.getGoogleClientIds = (req, res) => {
  try {
    const clientIds = {
      web: process.env.GOOGLE_CLIENT_ID || null,
      ios: process.env.GOOGLE_IOS_CLIENT_ID || null,
      android: process.env.GOOGLE_ANDROID_CLIENT_ID || null,
    };

    if (!clientIds.web && !clientIds.ios && !clientIds.android) {
      return res.status(500).json({
        success: false,
        message: "Google authentication is not configured on the server",
      });
    }

    res.status(200).json({
      success: true,
      clientIds,
    });
  } catch (error) {
    logger.error("Get Google client IDs error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};