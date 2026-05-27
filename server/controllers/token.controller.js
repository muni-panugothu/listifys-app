const { 
  generateAccessToken, 
  generateRefreshToken, 
  storeRefreshToken, 
  setRefreshTokenCookie,
  revokeAllUserTokens,
  getUserSessions,
  cleanupExpiredTokens
} = require('../utils/tokenUtils');
const { logger } = require('../utils/logger');

/**
 * Generate token pair for authenticated user
 * @param {Object} user - User object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Access token and user data
 */
exports.generateTokenResponse = async (user, req, res) => {
  try {
    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token in Upstash Redis
    await storeRefreshToken(user._id.toString(), refreshToken, req);

    // Set refresh token as HTTP-only cookie
    setRefreshTokenCookie(res, refreshToken);

    // Prepare user response (remove sensitive data)
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      provider: user.provider,
      avatar: user.avatar,
      profileImage: user.profileImage || null,
      googleProfileImage: user.googleProfileImage || null,
      isVerified: user.isVerified,
      profileImageUrl: user.getProfileImage
        ? user.getProfileImage()
        : user.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
    };

    logger.info('✅ Token pair generated and stored in Redis', { 
      userId: user._id,
      hasRefreshToken: !!refreshToken
    });

    return {
      accessToken,
      user: userResponse
    };
  } catch (error) {
    logger.error('❌ Error generating token response:', error);
    throw error;
  }
};

/**
 * Send token response to client
 * @param {Object} user - User object
 * @param {number} statusCode - HTTP status code
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 */
exports.sendTokenResponse = async (user, statusCode, res, message) => {
  try {
    const req = res.req; // Access original request object
    const { accessToken, user: userResponse } = await exports.generateTokenResponse(user, req, res);

    res.status(statusCode).json({
      success: true,
      message,
      token: accessToken, // Access token only in JSON
      user: userResponse
    });
  } catch (error) {
    logger.error('❌ Error sending token response:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating authentication tokens'
    });
  }
};

/**
 * Get all active sessions for logged in user
 */
exports.getUserSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const sessions = await getUserSessions(userId);
    
    res.status(200).json({
      success: true,
      sessions
    });
  } catch (error) {
    logger.error('❌ Error getting user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving sessions'
    });
  }
};

/**
 * Revoke specific session (logout from device)
 */
exports.revokeSession = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const userId = req.user.id;
    
    const { revokeRefreshToken } = require('../utils/tokenUtils');
    
    // Get token data first
    const redis = require('../config/redis');
    const tokenData = await redis.get(`refresh_token:${tokenId}`);
    
    if (!tokenData) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    const session = typeof tokenData === 'string' ? JSON.parse(tokenData) : tokenData;
    
    // Verify this session belongs to the user
    if (session.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to revoke this session'
      });
    }
    
    // Revoke the token
    await revokeRefreshToken(session.refreshToken);
    
    res.status(200).json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    logger.error('❌ Error revoking session:', error);
    res.status(500).json({
      success: false,
      message: 'Error revoking session'
    });
  }
};

/**
 * Admin: Get all sessions for any user
 */
exports.adminGetUserSessions = async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await getUserSessions(userId);
    
    res.status(200).json({
      success: true,
      sessions
    });
  } catch (error) {
    logger.error('❌ Error getting user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving sessions'
    });
  }
};

/**
 * Admin: Cleanup expired tokens (maintenance)
 */
exports.adminCleanupTokens = async (req, res) => {
  try {
    const cleaned = await cleanupExpiredTokens();
    
    res.status(200).json({
      success: true,
      message: `Cleaned up ${cleaned} expired tokens`,
      cleaned
    });
  } catch (error) {
    logger.error('❌ Error cleaning tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Error cleaning tokens'
    });
  }
};