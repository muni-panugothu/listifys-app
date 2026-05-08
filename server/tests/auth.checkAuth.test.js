/**
 * ============================================================
 *  TEST SUITE 4 — CheckAuth & Session Verification Tests
 * ============================================================
 *  Covers: checkAuth 3-step verification (JWT → MongoDB → Redis),
 *  ACCESS_TOKEN_EXPIRED handling, Redis soft check, DB down
 *  resilience, user data in response.
 *
 *  Total test cases: 14
 * ============================================================
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const {
  RedisMock,
  createMockUser,
  createMockReq,
  createMockRes,
  generateTestAccessToken,
  generateExpiredAccessToken,
} = require('./setup.js');

const mockRedis = new RedisMock();

// Mock dependencies
jest.mock('../config/redis', () => mockRedis);
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    userLog: jest.fn(), securityLog: jest.fn(), productLog: jest.fn(),
    requestLog: jest.fn(), dbLog: jest.fn(), emailLog: jest.fn(),
    stream: { write: jest.fn() },
  },
  flushLogs: jest.fn().mockResolvedValue(),
}));
jest.mock('../services/email.service', () => ({
  sendOTPEmail: jest.fn(),
  sendForgotPasswordOTPEmail: jest.fn(),
  sendPasswordResetSuccessEmail: jest.fn(),
  sendLoginNotificationEmail: jest.fn(),
}));
jest.mock('../services/device.service', () => ({
  createDeviceSession: jest.fn(() => ({ deviceId: 'test', deviceName: 'Test' })),
  formatDeviceForDisplay: jest.fn(d => d),
}));
jest.mock('../services/redis.service', () => ({
  getCachedProfileImage: jest.fn().mockResolvedValue(null),
  cacheProfileImage: jest.fn(),
}));
jest.mock('../services/googleAuth.OAuth', () => ({
  handleGoogleAuth: jest.fn(),
}));
jest.mock('../utils/passwordSecurity', () => ({
  validatePassword: jest.fn().mockResolvedValue({ isValid: true }),
  getPasswordRequirements: jest.fn(() => ({})),
}));
jest.mock('../services/s3.service', () => ({
  validateImage: jest.fn(),
  uploadProfileImage: jest.fn(),
  deleteImage: jest.fn(),
  toProxyUrl: jest.fn((url) => url),
}));

// Mock User model
const mockUserFindById = jest.fn();
jest.mock('../models/user.model.js', () => {
  const M = jest.fn();
  M.findOne = jest.fn();
  M.findById = mockUserFindById;
  M.create = jest.fn();
  M.findByIdAndUpdate = jest.fn();
  return M;
});

const authController = require('../controllers/auth.controller');

// ─── Test Suite ──────────────────────────────────────────────────────────────
describe('🔍 CHECK AUTH & SESSION TESTS', () => {
  let req, res;
  const testUserId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.reset();
    req = createMockReq();
    res = createMockRes();
  });

  // ========== 1. NO ACCESS TOKEN ==========
  describe('1. No Access Token', () => {
    test('TC-C01: Should return ACCESS_TOKEN_EXPIRED when no access token cookie', async () => {
      req.cookies = {};

      await authController.checkAuth(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.isAuthenticated).toBe(false);
      expect(res._json.code).toBe('ACCESS_TOKEN_EXPIRED');
    });
  });

  // ========== 2. EXPIRED ACCESS TOKEN ==========
  describe('2. Expired Access Token', () => {
    test('TC-C02: Should return ACCESS_TOKEN_EXPIRED for expired JWT', async () => {
      const expiredToken = generateExpiredAccessToken(testUserId);
      req.cookies = { accessToken: expiredToken };

      // Wait for expiry
      await new Promise(r => setTimeout(r, 100));

      await authController.checkAuth(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.isAuthenticated).toBe(false);
      expect(res._json.code).toBe('ACCESS_TOKEN_EXPIRED');
    });
  });

  // ========== 3. INVALID TOKEN ==========
  describe('3. Invalid Token', () => {
    test('TC-C03: Should return not authenticated for malformed token', async () => {
      req.cookies = { accessToken: 'garbage-token' };

      await authController.checkAuth(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.isAuthenticated).toBe(false);
    });

    test('TC-C04: Should reject refresh token type in access token cookie', async () => {
      const refreshToken = jwt.sign(
        { id: testUserId, type: 'refresh', jti: crypto.randomBytes(16).toString('hex') },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '7d' }
      );
      req.cookies = { accessToken: refreshToken };

      await authController.checkAuth(req, res);

      expect(res._json.isAuthenticated).toBe(false);
    });
  });

  // ========== 4. VALID TOKEN — STEP 2: MONGODB CHECK ==========
  describe('4. MongoDB User Verification (Step 2)', () => {
    test('TC-C05: Should return authenticated for valid token + existing user', async () => {
      const token = generateTestAccessToken(testUserId);
      req.cookies = { accessToken: token };
      
      const user = createMockUser({ _id: testUserId });
      mockUserFindById.mockResolvedValue(user);

      // Set up Redis session
      const jti = crypto.randomBytes(16).toString('hex');
      await mockRedis.sadd(`user_sessions:${testUserId}`, jti);
      await mockRedis.setex(`refresh_token:${jti}`, 604800, JSON.stringify({ userId: testUserId }));

      await authController.checkAuth(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.isAuthenticated).toBe(true);
      expect(res._json.user).toBeDefined();
      expect(res._json.user.id).toBe(testUserId);
    });

    test('TC-C06: Should return not authenticated if user not found in DB', async () => {
      const token = generateTestAccessToken(testUserId);
      req.cookies = { accessToken: token };

      mockUserFindById.mockResolvedValue(null);

      await authController.checkAuth(req, res);

      expect(res._json.isAuthenticated).toBe(false);
    });

    test('TC-C07: Should return 503 when MongoDB is down (keep session alive)', async () => {
      const token = generateTestAccessToken(testUserId);
      req.cookies = { accessToken: token };

      mockUserFindById.mockRejectedValue(new Error('MongoDB connection error'));

      await authController.checkAuth(req, res);

      expect(res.statusCode).toBe(503);
      expect(res._json.code).toBe('DB_UNAVAILABLE');
    });
  });

  // ========== 5. VALID TOKEN — STEP 3: REDIS SESSION CHECK ==========
  describe('5. Redis Session Verification (Step 3 — Soft Check)', () => {
    test('TC-C08: Should set redisSessionValid=true when session exists', async () => {
      const token = generateTestAccessToken(testUserId);
      req.cookies = { accessToken: token };

      const user = createMockUser({ _id: testUserId });
      mockUserFindById.mockResolvedValue(user);

      // Set up active Redis session
      const jti = 'active-session-jti';
      await mockRedis.sadd(`user_sessions:${testUserId}`, jti);
      await mockRedis.setex(`refresh_token:${jti}`, 604800, JSON.stringify({ userId: testUserId }));

      await authController.checkAuth(req, res);

      expect(res._json.redisSessionValid).toBe(true);
    });

    test('TC-C09: Should set redisSessionValid=false when no sessions in Redis', async () => {
      const token = generateTestAccessToken(testUserId);
      req.cookies = { accessToken: token };

      const user = createMockUser({ _id: testUserId });
      mockUserFindById.mockResolvedValue(user);

      // No Redis sessions

      await authController.checkAuth(req, res);

      expect(res._json.isAuthenticated).toBe(true); // Still authenticated (soft check)
      expect(res._json.redisSessionValid).toBe(false);
    });

    test('TC-C10: Should still authenticate even if Redis is down', async () => {
      const token = generateTestAccessToken(testUserId);
      req.cookies = { accessToken: token };

      const user = createMockUser({ _id: testUserId });
      mockUserFindById.mockResolvedValue(user);

      // Simulate Redis failure by making smembers throw
      const originalSmembers = mockRedis.smembers.bind(mockRedis);
      mockRedis.smembers = jest.fn().mockRejectedValue(new Error('Redis down'));

      await authController.checkAuth(req, res);

      // Should still be authenticated — Redis check is non-blocking
      expect(res._json.isAuthenticated).toBe(true);

      // Restore
      mockRedis.smembers = originalSmembers;
    });
  });

  // ========== 6. RESPONSE DATA ==========
  describe('6. Response Data Integrity', () => {
    test('TC-C11: Should include user profile data in response', async () => {
      const token = generateTestAccessToken(testUserId);
      req.cookies = { accessToken: token };

      const user = createMockUser({
        _id: testUserId,
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'user',
      });
      mockUserFindById.mockResolvedValue(user);

      await authController.checkAuth(req, res);

      const responseUser = res._json.user;
      expect(responseUser.name).toBe('Jane Doe');
      expect(responseUser.email).toBe('jane@example.com');
      expect(responseUser.role).toBe('user');
      expect(responseUser.profileImageUrl).toBeDefined();
    });

    test('TC-C12: Should NOT include password in response', async () => {
      const token = generateTestAccessToken(testUserId);
      req.cookies = { accessToken: token };

      const user = createMockUser({ _id: testUserId });
      mockUserFindById.mockResolvedValue(user);

      await authController.checkAuth(req, res);

      expect(res._json.user.password).toBeUndefined();
      expect(res._json.user.passwordHistory).toBeUndefined();
    });

    test('TC-C13: Should include password expiration info', async () => {
      const token = generateTestAccessToken(testUserId);
      req.cookies = { accessToken: token };

      const user = createMockUser({ _id: testUserId });
      user.passwordNeedsChange = jest.fn(() => ({
        needsChange: true,
        daysRemaining: 0,
        daysSinceChange: 91,
      }));
      mockUserFindById.mockResolvedValue(user);

      await authController.checkAuth(req, res);

      expect(res._json.user.passwordExpiration).toBeDefined();
      expect(res._json.user.passwordExpiration.needsChange).toBe(true);
    });

    test('TC-C14: Should handle server errors with 503 (not 500)', async () => {
      const token = generateTestAccessToken(testUserId);
      req.cookies = { accessToken: token };

      // Force an unexpected error
      mockUserFindById.mockImplementation(() => {
        throw new Error('Unexpected');
      });

      await authController.checkAuth(req, res);

      expect(res.statusCode).toBe(503);
      expect(res._json.code).toBe('DB_UNAVAILABLE');
    });
  });
});
