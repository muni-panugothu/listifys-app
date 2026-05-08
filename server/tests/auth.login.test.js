/**
 * ============================================================
 *  TEST SUITE 1 — Login Authentication Tests
 * ============================================================
 *  Covers: email/password login, Google OAuth, account lockout,
 *  brute-force protection, locked account handling, provider
 *  mismatch, missing credentials, and token generation.
 *
 *  Total test cases: 22
 * ============================================================
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ─── Mocks (must be set up BEFORE requiring the controller) ──────────────────
const {
  RedisMock,
  createMockUser,
  createMockReq,
  createMockRes,
  hashPassword,
  STRONG_PASSWORD,
  VALID_EMAIL,
} = require('./setup');

const mockRedis = new RedisMock();

// Mock Redis
jest.mock('../config/redis', () => mockRedis);

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    userLog: jest.fn(),
    securityLog: jest.fn(),
    productLog: jest.fn(),
    requestLog: jest.fn(),
    dbLog: jest.fn(),
    emailLog: jest.fn(),
    stream: { write: jest.fn() },
  },
  flushLogs: jest.fn().mockResolvedValue(),
}));

// Mock email service
jest.mock('../services/email.service', () => ({
  sendOTPEmail: jest.fn().mockResolvedValue(true),
  sendForgotPasswordOTPEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetSuccessEmail: jest.fn().mockResolvedValue(true),
  sendLoginNotificationEmail: jest.fn().mockResolvedValue(true),
}));

// Mock device service
jest.mock('../services/device.service', () => ({
  createDeviceSession: jest.fn(() => ({
    deviceId: 'test-device-id',
    deviceName: 'Test Device',
    deviceType: 'desktop',
    browser: 'Jest',
    os: 'Test OS',
    sessions: [],
  })),
  formatDeviceForDisplay: jest.fn((d) => ({ ...d })),
  getLocationFromIP: jest.fn(() => 'Unknown'),
}));

// Mock RedisService
jest.mock('../services/redis.service', () => ({
  getCachedProfileImage: jest.fn().mockResolvedValue(null),
  cacheProfileImage: jest.fn().mockResolvedValue(true),
  storeBlockedUser: jest.fn().mockResolvedValue(true),
  removeBlockedUser: jest.fn().mockResolvedValue(true),
  getBlockedUser: jest.fn().mockResolvedValue(null),
  trackWrongPasswordAttempt: jest.fn().mockResolvedValue(true),
  clearWrongPasswordAttempts: jest.fn().mockResolvedValue(true),
}));

// Mock Google Auth
jest.mock('../services/googleAuth.OAuth', () => ({
  handleGoogleAuth: jest.fn(),
}));

// Mock S3 Service (prevents aws.js from calling process.exit)
jest.mock('../services/s3.service', () => ({
  validateImage: jest.fn(),
  uploadProfileImage: jest.fn(),
  deleteImage: jest.fn(),
  toProxyUrl: jest.fn((url) => url),
}));

// Mock RabbitMQ producers — prevent real connection attempts during tests
jest.mock('../queues/producers/auth.producer', () => ({
  publishOTPEmail: jest.fn().mockResolvedValue(true),
  publishWelcomeEmail: jest.fn().mockResolvedValue(true),
  publishLoginNotificationEmail: jest.fn().mockResolvedValue(true),
  publishPasswordResetSuccessEmail: jest.fn().mockResolvedValue(true),
  publishSecurityAlert: jest.fn().mockResolvedValue(true),
  publishAuditLog: jest.fn().mockResolvedValue(true),
}));

// Mock password security
jest.mock('../utils/passwordSecurity', () => ({
  validatePassword: jest.fn().mockResolvedValue({ isValid: true, errors: [], strength: 85 }),
  getPasswordRequirements: jest.fn(() => ({ minLength: 8 })),
}));

// Mock User model
const mockUserInstance = createMockUser();
const mockUserFindOne = jest.fn();
const mockUserFindById = jest.fn();
const mockUserCreate = jest.fn();

jest.mock('../models/user.model', () => {
  const MockUserModel = jest.fn();
  MockUserModel.findOne = mockUserFindOne;
  MockUserModel.findById = mockUserFindById;
  MockUserModel.create = mockUserCreate;
  return MockUserModel;
});

// Now require the controller
const authController = require('../controllers/auth.controller');

// ─── Test Suite ──────────────────────────────────────────────────────────────
describe('🔐 LOGIN AUTHENTICATION TESTS', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.reset();
    req = createMockReq();
    res = createMockRes();
  });

  // ========== 1. BASIC LOGIN VALIDATION ==========
  describe('1. Input Validation', () => {
    test('TC-L01: Should reject login with missing email', async () => {
      req.body = { password: STRONG_PASSWORD };
      await authController.login(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.success).toBe(false);
      expect(res._json.message).toMatch(/provide email and password/i);
    });

    test('TC-L02: Should reject login with missing password', async () => {
      req.body = { email: VALID_EMAIL };
      await authController.login(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.success).toBe(false);
    });

    test('TC-L03: Should reject login with empty body', async () => {
      req.body = {};
      await authController.login(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.success).toBe(false);
    });
  });

  // ========== 2. INVALID CREDENTIALS ==========
  describe('2. Invalid Credentials', () => {
    test('TC-L04: Should reject login with non-existent email', async () => {
      req.body = { email: 'nonexistent@test.com', password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await authController.login(req, res);

      expect(res.statusCode).toBe(401);
      expect(res._json.success).toBe(false);
      expect(res._json.code).toBe('USER_NOT_REGISTERED');
    });

    test('TC-L05: Should reject login with wrong password', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ password: hashedPw, email: VALID_EMAIL });

      req.body = { email: VALID_EMAIL, password: 'WrongP@ssw0rd!' };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.login(req, res);

      expect(res.statusCode).toBe(401);
      expect(res._json.success).toBe(false);
      expect(res._json.message).toMatch(/invalid email or password/i);
    });

    test('TC-L06: Should increment login attempts on wrong password', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ password: hashedPw });
      
      req.body = { email: VALID_EMAIL, password: 'WrongP@ss1!' };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.login(req, res);

      expect(user.incrementLoginAttempts).toHaveBeenCalled();
    });

    test('TC-L07: Should log failed login to history', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ password: hashedPw });

      req.body = { email: VALID_EMAIL, password: 'WrongP@ss1!' };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.login(req, res);

      expect(user.addLoginHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          failureReason: 'invalid_password',
        })
      );
    });

    test('TC-L08: Should log security event on failed login', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ password: hashedPw });

      req.body = { email: VALID_EMAIL, password: 'WrongP@ss1!' };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.login(req, res);

      expect(user.addSecurityLog).toHaveBeenCalledWith(
        'failed_login',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ reason: 'invalid_password' })
      );
    });
  });

  // ========== 3. ACCOUNT LOCKOUT ==========
  describe('3. Account Lockout (Brute-Force Protection)', () => {
    test('TC-L09: Should reject login for locked account', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const lockedUser = createMockUser({
        password: hashedPw,
        loginAttempts: 5,
        lockUntil: Date.now() + 3600000, // Locked for 1 hour
      });
      lockedUser.isLocked = jest.fn(() => true);

      req.body = { email: VALID_EMAIL, password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(lockedUser),
      });

      await authController.login(req, res);

      expect(res.statusCode).toBe(423);
      expect(res._json.success).toBe(false);
      expect(res._json.code).toBe('ACCOUNT_LOCKED');
      expect(res._json.locked).toBe(true);
    });

    test('TC-L10: Should log failed attempt for locked account', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const lockedUser = createMockUser({
        password: hashedPw,
        loginAttempts: 5,
        lockUntil: Date.now() + 3600000,
      });
      lockedUser.isLocked = jest.fn(() => true);

      req.body = { email: VALID_EMAIL, password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(lockedUser),
      });

      await authController.login(req, res);

      expect(lockedUser.addLoginHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          failureReason: 'account_locked',
        })
      );
    });

    test('TC-L11: Lock check should happen BEFORE password result processing', async () => {
      // Even with CORRECT password, locked account should be rejected
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const lockedUser = createMockUser({
        password: hashedPw,
        loginAttempts: 5,
        lockUntil: Date.now() + 3600000,
      });
      lockedUser.isLocked = jest.fn(() => true);

      req.body = { email: VALID_EMAIL, password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(lockedUser),
      });

      await authController.login(req, res);

      // Should be locked, NOT 200 success
      expect(res.statusCode).toBe(423);
    });
  });

  // ========== 4. PROVIDER MISMATCH ==========
  describe('4. Provider Mismatch', () => {
    test('TC-L12: Should reject email/password login for Google-only account', async () => {
      const googleUser = createMockUser({ provider: 'google', password: null });

      req.body = { email: VALID_EMAIL, password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(googleUser),
      });

      await authController.login(req, res);

      expect(res.statusCode).toBe(401);
      expect(res._json.code).toBe('INVALID_CREDENTIALS');
    });

    test('TC-L13: Should handle account with no password set', async () => {
      const noPasswordUser = createMockUser({ provider: 'local', password: null });

      req.body = { email: VALID_EMAIL, password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(noPasswordUser),
      });

      await authController.login(req, res);

      expect(res.statusCode).toBe(401);
      expect(res._json.code).toBe('INVALID_CREDENTIALS');
    });
  });

  // ========== 5. SUCCESSFUL LOGIN ==========
  describe('5. Successful Login', () => {
    test('TC-L14: Should login with correct credentials', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ password: hashedPw, email: VALID_EMAIL });

      req.body = { email: VALID_EMAIL, password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.login(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.message).toMatch(/login successful/i);
    });

    test('TC-L15: Should return user data on successful login', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ password: hashedPw, email: VALID_EMAIL });

      req.body = { email: VALID_EMAIL, password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.login(req, res);

      expect(res._json.user).toBeDefined();
      expect(res._json.user.email).toBe(VALID_EMAIL);
      expect(res._json.user.id).toBeDefined();
      // Password should NOT be in response
      expect(res._json.user.password).toBeUndefined();
    });

    test('TC-L16: Should set HTTP-only cookies on successful login', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ password: hashedPw, email: VALID_EMAIL });

      req.body = { email: VALID_EMAIL, password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.login(req, res);

      expect(res.cookie).toHaveBeenCalled();
      // Verify accessToken cookie was set
      const accessTokenCall = res.cookie.mock.calls.find(c => c[0] === 'accessToken');
      expect(accessTokenCall).toBeDefined();
      expect(accessTokenCall[2].httpOnly).toBe(true);

      // Verify refreshToken cookie was set
      const refreshTokenCall = res.cookie.mock.calls.find(c => c[0] === 'refreshToken');
      expect(refreshTokenCall).toBeDefined();
      expect(refreshTokenCall[2].httpOnly).toBe(true);
    });

    test('TC-L17: Should reset login attempts on successful login', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ password: hashedPw, loginAttempts: 3 });

      req.body = { email: VALID_EMAIL, password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.login(req, res);

      expect(user.resetLoginAttempts).toHaveBeenCalled();
    });

    test('TC-L18: Should store refresh token in Redis on successful login', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ password: hashedPw, email: VALID_EMAIL });

      req.body = { email: VALID_EMAIL, password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.login(req, res);

      // Check that at least one refresh_token key exists in Redis
      const keys = Array.from(mockRedis.store.keys());
      const refreshTokenKeys = keys.filter(k => k.startsWith('refresh_token:'));
      expect(refreshTokenKeys.length).toBeGreaterThan(0);
    });

    test('TC-L19: Should record login in history', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ password: hashedPw, email: VALID_EMAIL });

      req.body = { email: VALID_EMAIL, password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.login(req, res);

      expect(user.addLoginHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          loginType: 'email',
          success: true,
        })
      );
    });

    test('TC-L20: Should create device session', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ password: hashedPw, email: VALID_EMAIL });

      req.body = { email: VALID_EMAIL, password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.login(req, res);

      expect(user.updateDeviceSession).toHaveBeenCalled();
      expect(res._json.user.currentDevice).toBeDefined();
    });
  });

  // ========== 6. EDGE CASES ==========
  describe('6. Edge Cases', () => {
    test('TC-L21: Should handle database errors gracefully', async () => {
      req.body = { email: VALID_EMAIL, password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('DB connection failed')),
      });

      await authController.login(req, res);

      expect(res.statusCode).toBe(500);
      expect(res._json.success).toBe(false);
    });

    test('TC-L22: Should return tokenExists cookie (httpOnly) for auth state tracking', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ password: hashedPw, email: VALID_EMAIL });

      req.body = { email: VALID_EMAIL, password: STRONG_PASSWORD };
      mockUserFindOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.login(req, res);

      const tokenExistsCall = res.cookie.mock.calls.find(c => c[0] === 'tokenExists');
      expect(tokenExistsCall).toBeDefined();
      expect(tokenExistsCall[2].httpOnly).toBe(true);
    });
  });
});
