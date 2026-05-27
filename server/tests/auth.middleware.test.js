/**
 * ============================================================
 *  TEST SUITE 3 — Auth Middleware Tests
 * ============================================================
 *  Covers: protect middleware (JWT verification, token types,
 *  expired tokens, DB unavailability), refresh middleware,
 *  logout, logoutAll, role authorization.
 *
 *  Total test cases: 22
 * ============================================================
 */

const jwt = require('jsonwebtoken');

const {
  RedisMock,
  createMockUser,
  createMockReq,
  createMockRes,
  generateTestAccessToken,
  generateTestRefreshToken,
  generateExpiredAccessToken,
} = require('./setup');

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

// Mock tokenUtils
const mockRefreshTokens = jest.fn();
const mockRevokeRefreshToken = jest.fn();
const mockRevokeAllUserTokens = jest.fn();
const mockClearRefreshTokenCookie = jest.fn();
const mockSetRefreshTokenCookie = jest.fn();

jest.mock('../utils/tokenUtils', () => ({
  refreshTokens: (...args) => mockRefreshTokens(...args),
  revokeRefreshToken: (...args) => mockRevokeRefreshToken(...args),
  revokeAllUserTokens: (...args) => mockRevokeAllUserTokens(...args),
  clearRefreshTokenCookie: (...args) => mockClearRefreshTokenCookie(...args),
  setRefreshTokenCookie: (...args) => mockSetRefreshTokenCookie(...args),
  setTokenCookies: jest.fn(),
}));

// Mock User model
const mockUser = createMockUser();
jest.mock('../models/user.model', () => {
  const MockModel = jest.fn();
  MockModel.findById = jest.fn();
  return MockModel;
});
const User = require('../models/user.model');

const authMiddleware = require('../middleware/auth.middleware');

// ─── Test Suite ──────────────────────────────────────────────────────────────
describe('🛡️ AUTH MIDDLEWARE TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.reset();
    req = createMockReq();
    res = createMockRes();
    next = jest.fn();
  });

  // ========== 1. PROTECT MIDDLEWARE — NO TOKEN ==========
  describe('1. Protect — Missing Token', () => {
    test('TC-M01: Should reject request with no access token', async () => {
      req.cookies = {};
      req.headers = {};

      await authMiddleware.protect(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res._json.code).toBe('NO_TOKEN');
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ========== 2. PROTECT MIDDLEWARE — VALID TOKEN ==========
  describe('2. Protect — Valid Token', () => {
    test('TC-M02: Should authenticate with valid access token in cookie', async () => {
      const token = generateTestAccessToken(mockUser._id);
      req.cookies = { accessToken: token };
      
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await authMiddleware.protect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user._id).toBe(mockUser._id);
    });

    test('TC-M03: Should authenticate with Bearer token in header', async () => {
      const token = generateTestAccessToken(mockUser._id);
      req.headers = { authorization: `Bearer ${token}` };
      req.cookies = {};

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await authMiddleware.protect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
    });

    test('TC-M04: Cookie token should take priority over Bearer header', async () => {
      const cookieToken = generateTestAccessToken(mockUser._id);
      const headerToken = generateTestAccessToken('different-user-id');

      req.cookies = { accessToken: cookieToken };
      req.headers = { authorization: `Bearer ${headerToken}` };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await authMiddleware.protect(req, res, next);

      // Should use cookie token (mockUser._id), not header token
      expect(next).toHaveBeenCalled();
    });
  });

  // ========== 3. PROTECT MIDDLEWARE — INVALID / EXPIRED TOKEN ==========
  describe('3. Protect — Invalid / Expired Token', () => {
    test('TC-M05: Should reject request with expired access token', async () => {
      const expiredToken = generateExpiredAccessToken(mockUser._id);
      req.cookies = { accessToken: expiredToken };

      // Wait for expiry
      await new Promise(r => setTimeout(r, 100));

      await authMiddleware.protect(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res._json.code).toBe('TOKEN_EXPIRED');
      expect(next).not.toHaveBeenCalled();
    });

    test('TC-M06: Should reject request with malformed token', async () => {
      req.cookies = { accessToken: 'invalid.token.here' };

      await authMiddleware.protect(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res._json.code).toBe('INVALID_TOKEN');
    });

    test('TC-M07: Should reject refresh token used as access token', async () => {
      const refreshToken = jwt.sign(
        { id: mockUser._id, type: 'refresh', jti: 'test-jti' },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '7d' }
      );
      req.cookies = { accessToken: refreshToken };

      await authMiddleware.protect(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res._json.code).toBe('INVALID_TOKEN_TYPE');
    });
  });

  // ========== 4. PROTECT — USER STATUS CHECKS ==========
  describe('4. Protect — User Status', () => {
    test('TC-M08: Should reject if user no longer exists', async () => {
      const token = generateTestAccessToken(mockUser._id);
      req.cookies = { accessToken: token };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await authMiddleware.protect(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res._json.code).toBe('USER_NOT_FOUND');
    });

    test('TC-M09: Should reject if user account is suspended', async () => {
      const token = generateTestAccessToken(mockUser._id);
      req.cookies = { accessToken: token };

      const suspendedUser = createMockUser({ status: 'suspended' });
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(suspendedUser),
      });

      await authMiddleware.protect(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res._json.code).toBe('ACCOUNT_INACTIVE');
    });

    test('TC-M10: Should reject if user account is banned', async () => {
      const token = generateTestAccessToken(mockUser._id);
      req.cookies = { accessToken: token };

      const bannedUser = createMockUser({ status: 'banned' });
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(bannedUser),
      });

      await authMiddleware.protect(req, res, next);

      expect(res.statusCode).toBe(403);
    });
  });

  // ========== 5. PROTECT — DB UNAVAILABILITY ==========
  describe('5. Protect — Database Unavailability', () => {
    test('TC-M11: Should return 503 when MongoDB is down (not 401)', async () => {
      const token = generateTestAccessToken(mockUser._id);
      req.cookies = { accessToken: token };

      User.findById.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('MongoDB connection lost')),
      });

      await authMiddleware.protect(req, res, next);

      expect(res.statusCode).toBe(503);
      expect(res._json.code).toBe('DB_UNAVAILABLE');
      // Critical: should NOT be 401 (which would trigger logout)
    });
  });

  // ========== 6. REFRESH TOKEN MIDDLEWARE ==========
  describe('6. Refresh Token', () => {
    test('TC-M12: Should reject refresh with missing refresh token', async () => {
      req.cookies = {};

      await authMiddleware.refreshToken(req, res);

      expect(res.statusCode).toBe(401);
      expect(res._json.code).toBe('NO_REFRESH_TOKEN');
    });

    test('TC-M13: Should refresh tokens successfully', async () => {
      const oldRefresh = generateTestRefreshToken(mockUser._id);
      const newAccess = generateTestAccessToken(mockUser._id);
      const newRefresh = generateTestRefreshToken(mockUser._id);

      req.cookies = { refreshToken: oldRefresh };
      mockRefreshTokens.mockResolvedValue({
        tokens: { accessToken: newAccess, refreshToken: newRefresh },
      });

      await authMiddleware.refreshToken(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
    });

    test('TC-M14: Should clear cookies on invalid refresh token', async () => {
      req.cookies = { refreshToken: 'invalid-refresh-token' };
      mockRefreshTokens.mockResolvedValue({ error: 'invalid' });

      await authMiddleware.refreshToken(req, res);

      expect(res.statusCode).toBe(401);
      expect(res._json.code).toBe('INVALID_REFRESH_TOKEN');
    });

    test('TC-M15: Should return 503 on transient error (not clear cookies)', async () => {
      const token = generateTestRefreshToken(mockUser._id);
      req.cookies = { refreshToken: token };
      mockRefreshTokens.mockResolvedValue({ error: 'transient' });

      await authMiddleware.refreshToken(req, res);

      expect(res.statusCode).toBe(503);
      expect(res._json.code).toBe('REFRESH_TRANSIENT_ERROR');
      // Cookies should NOT be cleared
      expect(res._clearedCookies).not.toContain('refreshToken');
    });

    test('TC-M16: Should handle concurrent refresh gracefully', async () => {
      const token = generateTestRefreshToken(mockUser._id);
      req.cookies = { refreshToken: token };
      mockRefreshTokens.mockResolvedValue({ concurrentRefresh: true });

      await authMiddleware.refreshToken(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.code).toBe('CONCURRENT_REFRESH');
    });
  });

  // ========== 7. LOGOUT ==========
  describe('7. Logout', () => {
    test('TC-M17: Should logout successfully with refresh token', async () => {
      const token = generateTestRefreshToken(mockUser._id);
      req.cookies = { refreshToken: token };
      mockRevokeRefreshToken.mockResolvedValue(true);

      await authMiddleware.logout(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(mockRevokeRefreshToken).toHaveBeenCalledWith(token);
    });

    test('TC-M18: Should clear all cookies on logout', async () => {
      req.cookies = { refreshToken: 'some-token' };
      mockRevokeRefreshToken.mockResolvedValue(true);

      await authMiddleware.logout(req, res);

      expect(res.clearCookie).toHaveBeenCalled();
      // Should clear accessToken + tokenExists via res.clearCookie
      // refreshToken is cleared via clearRefreshTokenCookie (mocked)
      const clearedNames = res.clearCookie.mock.calls.map(c => c[0]);
      expect(clearedNames).toContain('accessToken');
      expect(clearedNames).toContain('tokenExists');
      expect(mockClearRefreshTokenCookie).toHaveBeenCalledWith(res);
    });

    test('TC-M19: Should handle logout with no refresh token', async () => {
      req.cookies = {};

      await authMiddleware.logout(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
    });
  });

  // ========== 8. LOGOUT ALL DEVICES ==========
  describe('8. Logout All Devices', () => {
    test('TC-M20: Should revoke all tokens for user', async () => {
      req.user = { id: mockUser._id };
      mockRevokeAllUserTokens.mockResolvedValue(true);

      await authMiddleware.logoutAll(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockRevokeAllUserTokens).toHaveBeenCalledWith(mockUser._id);
    });
  });

  // ========== 9. ROLE AUTHORIZATION ==========
  describe('9. Role Authorization', () => {
    test('TC-M21: Should allow authorized role', () => {
      req.user = { role: 'admin' };
      const middleware = authMiddleware.authorize('admin', 'moderator');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('TC-M22: Should reject unauthorized role', () => {
      req.user = { role: 'user' };
      const middleware = authMiddleware.authorize('admin');

      middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
