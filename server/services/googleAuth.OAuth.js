const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { OAuth2Client } = require("google-auth-library");
const { logger } = require("../utils/logger");
const User = require("../models/user.model");

// Validate Google Client ID on initialization
if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error("Google authentication not configured — GOOGLE_CLIENT_ID missing");
}

logger.info('Google Client ID configured');

// All valid audiences: web + iOS + Android client IDs
const GOOGLE_AUDIENCES = [
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_IOS_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
].filter(Boolean);

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleIdToken = async (idToken) => {
  try {
    logger.info('Verifying Google ID token');

    if (!idToken || typeof idToken !== "string" || idToken.length < 100) {
      throw new Error(
        "Invalid Google ID Token format - token is too short or malformed",
      );
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_AUDIENCES,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error("Invalid Google ID Token - no payload received");
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp < currentTime) {
      throw new Error("Google ID token has expired");
    }

    if (!GOOGLE_AUDIENCES.includes(payload.aud)) {
      logger.error('Google token audience mismatch', { aud: payload.aud });
      throw new Error(
        "Invalid audience for Google ID token. Make sure you're using the correct Google Client ID.",
      );
    }

    logger.info('Google ID token verified successfully');

    return {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified || false,
      name: payload.name,
      givenName: payload.given_name,
      familyName: payload.family_name,
      picture: payload.picture,
      locale: payload.locale,
    };
  } catch (error) {
    logger.error('Google ID token verification failed', { error: error.message });

    let errorMessage = error.message;
    throw new Error(`Google authentication failed: ${errorMessage}`);
  }
};

// ==================== FIXED: findOrCreateGoogleUser FUNCTION ====================
const findOrCreateGoogleUser = async (googleUserInfo, req = null) => {
  try {
    logger.info('Finding or creating Google user');

    let user = await User.findOne({
      $or: [
        { googleId: googleUserInfo.googleId },
        { email: googleUserInfo.email },
      ],
    });

    if (user) {
      logger.info('Existing user found for Google auth');

      if (!user.googleId) {
        logger.info('Linking Google account to existing user');
        user.googleId = googleUserInfo.googleId;
        user.isVerified = true;
        user.provider = "google";

        if (googleUserInfo.picture) {
          user.googleProfileImage = googleUserInfo.picture;
          if (
            !user.avatar ||
            user.avatar.includes(
              "cdn-icons-png.flaticon.com/512/149/149071.png",
            )
          ) {
            user.avatar = googleUserInfo.picture;
          }
        }

        await user.save();

        if (req && user.addSecurityLog) {
          await user.addSecurityLog(
            "google_account_linked",
            req.ip,
            req.get("user-agent"),
            { source: "google" },
          );
        }

        logger.info("Google account linked to existing user", {
          userId: user._id,
          email: user.email,
        });
      } else {
        logger.info('Updating existing Google user');

        if (googleUserInfo.picture) {
          user.googleProfileImage = googleUserInfo.picture;
          if (!user.profileImage) {
            user.avatar = googleUserInfo.picture;
          }
            logger.info('Updated Google profile image');
        }

        await user.save();

        logger.info("Updated Google user profile", {
          userId: user._id,
          email: user.email,
        });
      }

      if (user.updateLastLogin && req) {
        await user.updateLastLogin(req.ip, req.get("user-agent"));
      }

      return { user, isNew: false };
    } else {
      logger.info('Creating new Google user');

      user = new User({
        googleId: googleUserInfo.googleId,
        email: googleUserInfo.email,
        name: googleUserInfo.name,
        avatar: googleUserInfo.picture,
        googleProfileImage: googleUserInfo.picture,
        isVerified: true,
        provider: "google",
      });

      await user.save();

      logger.info('New Google user created successfully');

      if (req && user.addSecurityLog) {
        await user.addSecurityLog(
          "account_created",
          req.ip,
          req.get("user-agent"),
          {
            source: "google",
          },
        );
      }

      return { user, isNew: true };
    }
  } catch (error) {
    const logMeta = { error: error.message };
    if (process.env.NODE_ENV !== 'production') {
      logMeta.stack = error.stack;
    }
    logger.error('Failed to find or create Google user', logMeta);
    throw error;
  }
};

// ==================== handleGoogleAuth FUNCTION ====================
const handleGoogleAuth = async (idToken, req = null) => {
  try {
    logger.info('Starting Google authentication process');

    const googleUserInfo = await verifyGoogleIdToken(idToken);

    const { user, isNew } = await findOrCreateGoogleUser(googleUserInfo, req);

    logger.info('Google authentication completed successfully');

    return { user, isNew };
  } catch (error) {
    logger.error("Google authentication failed", {
      error: error.message,
    });
    throw new Error(`Google authentication failed: ${error.message}`);
  }
};

module.exports = {
  verifyGoogleIdToken,
  findOrCreateGoogleUser,
  handleGoogleAuth,
};