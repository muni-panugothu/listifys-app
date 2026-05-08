/**
 * ============================================================
 *  TEST SUITE 6 — Password Security & Change/Reset Tests
 * ============================================================
 *  Covers: Password strength validation, change password flow,
 *  forgot-password OTP flow, reset-password-with-token flow,
 *  password history enforcement, password expiration.
 *
 *  Total test cases: 16
 * ============================================================
 */

const bcrypt = require('bcryptjs');

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
  sendOTPEmail: jest.fn().mockResolvedValue(true),
  sendForgotPasswordOTPEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetSuccessEmail: jest.fn().mockResolvedValue(true),
  sendLoginNotificationEmail: jest.fn().mockResolvedValue(true),
}));
jest.mock('../services/device.service', () => ({
  createDeviceSession: jest.fn(() => ({ deviceId: 'test', deviceName: 'Test', sessions: [] })),
  formatDeviceForDisplay: jest.fn(d => d),
}));
jest.mock('../services/redis.service', () => ({
  getPendingRegistration: jest.fn().mockResolvedValue(null),
  storePendingRegistration: jest.fn().mockResolvedValue(true),
  deletePendingRegistration: jest.fn().mockResolvedValue(true),
  storeOTP: jest.fn().mockResolvedValue(true),
  deleteOTP: jest.fn().mockResolvedValue(true),
  verifyOTP: jest.fn().mockResolvedValue({ valid: true }),
  checkEmailBlocked: jest.fn().mockResolvedValue(false),
  incrementRegistrationAttempts: jest.fn(),
  checkOTPBlocked: jest.fn().mockResolvedValue({ blocked: false }),
  incrementOTPAttempts: jest.fn().mockResolvedValue({ attempts: 1, blocked: false }),
  clearOTPAttempts: jest.fn().mockResolvedValue(true),
  clearOTPBlock: jest.fn().mockResolvedValue(true),
  getPendingPasswordReset: jest.fn().mockResolvedValue(null),
  storePendingPasswordReset: jest.fn().mockResolvedValue(true),
  deletePendingPasswordReset: jest.fn().mockResolvedValue(true),
  getCachedProfileImage: jest.fn().mockResolvedValue(null),
  cacheProfileImage: jest.fn(),
}));
jest.mock('../services/googleAuth.OAuth', () => ({
  handleGoogleAuth: jest.fn(),
}));
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

const mockValidatePassword = jest.fn().mockResolvedValue({
  isValid: true,
  errors: [],
  strength: 85,
  breach: { found: false },
});
jest.mock('../utils/passwordSecurity', () => ({
  validatePassword: (...args) => mockValidatePassword(...args),
  getPasswordRequirements: jest.fn(() => ({ minLength: 8 })),
}));

const mockUserFindOne = jest.fn();
const mockUserFindById = jest.fn();
const mockCreateUser = createMockUser; // alias with mock prefix for jest.mock scope
jest.mock('../models/user.model', () => {
  const M = jest.fn(function(data) {
    return mockCreateUser(data);
  });
  M.findOne = (...args) => {
    const result = mockUserFindOne(...args);
    // Support chaining: .select() just returns the same promise
    if (result && typeof result.then === 'function') {
      result.select = () => result;
      return result;
    }
    // If it's a plain value, wrap as chainable
    return {
      select: () => Promise.resolve(result),
    };
  };
  M.findById = (...args) => mockUserFindById(...args);
  M.create = jest.fn();
  M.findByIdAndUpdate = jest.fn();
  return M;
});

const authController = require('../controllers/auth.controller');

// ─── Test Suite ──────────────────────────────────────────────────────────────
describe('🔐 PASSWORD SECURITY & CHANGE/RESET TESTS', () => {
  let req, res;
  const testUserId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.reset();
    req = createMockReq();
    res = createMockRes();
    mockValidatePassword.mockResolvedValue({ isValid: true, errors: [], strength: 85 });
  });

  // ========== 1. CHANGE PASSWORD ==========
  describe('1. Change Password', () => {
    test('TC-P01: Should reject with missing fields', async () => {
      req.user = { id: testUserId };
      req.body = { currentPassword: STRONG_PASSWORD };

      await authController.changePassword(req, res);

      expect(res.statusCode).toBe(400);
    });

    test('TC-P02: Should reject if new passwords do not match', async () => {
      req.user = { id: testUserId };
      req.body = {
        currentPassword: STRONG_PASSWORD,
        newPassword: 'NewSecure@1!',
        confirmNewPassword: 'DifferentP@ss1!',
      };

      await authController.changePassword(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.message).toMatch(/do not match/i);
    });

    test('TC-P03: Should reject if current password is wrong', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ _id: testUserId, password: hashedPw });

      req.user = { id: testUserId };
      req.body = {
        currentPassword: 'WrongOldP@ss1!',
        newPassword: 'NewSecure@1!',
        confirmNewPassword: 'NewSecure@1!',
      };

      mockUserFindById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.changePassword(req, res);

      expect(res.statusCode).toBe(401);
      expect(res._json.message).toMatch(/current password is incorrect/i);
    });

    test('TC-P04: Should reject if new password fails strength check', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ _id: testUserId, password: hashedPw });

      mockValidatePassword.mockResolvedValue({
        isValid: false,
        errors: ['Password too weak'],
      });

      req.user = { id: testUserId };
      req.body = {
        currentPassword: STRONG_PASSWORD,
        newPassword: '123',
        confirmNewPassword: '123',
      };

      mockUserFindById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.changePassword(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.message).toMatch(/security requirements/i);
    });

    test('TC-P05: Should reject if new password is in history', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ _id: testUserId, password: hashedPw });
      user.isPasswordInHistory = jest.fn().mockResolvedValue({
        inHistory: true,
        message: 'You used this password recently',
      });

      req.user = { id: testUserId };
      req.body = {
        currentPassword: STRONG_PASSWORD,
        newPassword: 'ReusedP@ss1!',
        confirmNewPassword: 'ReusedP@ss1!',
      };

      mockUserFindById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.changePassword(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.message).toMatch(/used this password/i);
    });

    test('TC-P06: Should change password successfully', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ _id: testUserId, password: hashedPw });

      req.user = { id: testUserId };
      req.body = {
        currentPassword: STRONG_PASSWORD,
        newPassword: 'NewSecure@1!',
        confirmNewPassword: 'NewSecure@1!',
      };

      mockUserFindById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.changePassword(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(user.addToPasswordHistory).toHaveBeenCalled();
      expect(user.save).toHaveBeenCalled();
    });

    test('TC-P07: Should accept both confirmNewPassword and confirmPassword', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ _id: testUserId, password: hashedPw });

      req.user = { id: testUserId };
      req.body = {
        currentPassword: STRONG_PASSWORD,
        newPassword: 'NewSecure@1!',
        confirmPassword: 'NewSecure@1!', // Using legacy field name
      };

      mockUserFindById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.changePassword(req, res);

      expect(res.statusCode).toBe(200);
    });
  });

  // ========== 2. FORGOT PASSWORD INITIATION ==========
  describe('2. Forgot Password', () => {
    test('TC-P08: Should reject with missing email', async () => {
      req.body = {};
      await authController.initiateForgotPassword(req, res);

      expect(res.statusCode).toBe(400);
    });

    test('TC-P09: Should return generic success for non-existent email (anti-enumeration)', async () => {
      req.body = { email: 'nonexistent@test.com' };
      mockUserFindOne.mockResolvedValue(null);

      await authController.initiateForgotPassword(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.message).toMatch(/if an account exists/i);
    });

    test('TC-P10: Should reject if reset already in progress', async () => {
      const RedisService = require('../services/redis.service');
      RedisService.getPendingPasswordReset.mockResolvedValue({
        email: VALID_EMAIL,
        createdAt: new Date().toISOString(),
      });
      mockUserFindOne.mockResolvedValue(createMockUser());

      req.body = { email: VALID_EMAIL };
      await authController.initiateForgotPassword(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.message).toMatch(/already in progress/i);
    });
  });

  // ========== 3. PASSWORD EXPIRATION ==========
  describe('3. Password Expiration', () => {
    test('TC-P11: Should return password expiration status', async () => {
      const user = createMockUser({
        _id: testUserId,
        lastPasswordChange: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000),
      });
      user.passwordNeedsChange = jest.fn(() => ({
        needsChange: false,
        daysRemaining: 1,
        daysSinceChange: 89,
        shouldWarn: true,
      }));

      req.user = { id: testUserId };
      mockUserFindById.mockResolvedValue(user);

      await authController.checkPasswordExpiration(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.expiration.shouldWarn).toBe(true);
    });

    test('TC-P12: Should flag password needing change after 90 days', async () => {
      const user = createMockUser({
        _id: testUserId,
        lastPasswordChange: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
      });
      user.passwordNeedsChange = jest.fn(() => ({
        needsChange: true,
        daysRemaining: 0,
        daysSinceChange: 91,
      }));

      req.user = { id: testUserId };
      mockUserFindById.mockResolvedValue(user);

      await authController.checkPasswordExpiration(req, res);

      expect(res._json.expiration.needsChange).toBe(true);
    });
  });

  // ========== 4. RESET PASSWORD WITH TOKEN ==========
  describe('4. Reset Password with Token', () => {
    test('TC-P13: Should reject with missing reset token', async () => {
      req.params = {};
      req.body = { email: VALID_EMAIL, password: 'New@Pass1!', confirmPassword: 'New@Pass1!' };

      await authController.resetPasswordWithToken(req, res);

      expect(res.statusCode).toBe(400);
    });

    test('TC-P14: Should reject if reset token not found in Redis', async () => {
      req.params = { resetToken: 'expired-token-here' };
      req.body = { email: VALID_EMAIL, password: 'New@Pass1!', confirmPassword: 'New@Pass1!' };

      await authController.resetPasswordWithToken(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.message).toMatch(/invalid or.*expired/i);
    });

    test('TC-P15: Should reject if passwords do not match', async () => {
      req.params = { resetToken: 'valid-token' };
      req.body = {
        email: VALID_EMAIL,
        password: 'New@Pass1!',
        confirmPassword: 'Different@Pass1!',
      };

      await authController.resetPasswordWithToken(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.message).toMatch(/do not match/i);
    });

    test('TC-P16: Should reset password successfully with valid token', async () => {
      const hashedPw = await hashPassword(STRONG_PASSWORD);
      const user = createMockUser({ _id: testUserId, password: hashedPw, email: VALID_EMAIL });

      // Store reset token data in Redis
      const resetToken = 'valid-reset-token-abc123';
      await mockRedis.setex(
        `reset:${resetToken}`,
        600,
        JSON.stringify({ userId: testUserId, email: VALID_EMAIL })
      );
      await mockRedis.setex(`reset_email:${resetToken}`, 600, VALID_EMAIL);

      req.params = { resetToken };
      req.body = {
        email: VALID_EMAIL,
        password: 'BrandNew@Pass1!',
        confirmPassword: 'BrandNew@Pass1!',
      };

      mockUserFindById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      await authController.resetPasswordWithToken(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.message).toMatch(/reset successfully/i);
      expect(user.save).toHaveBeenCalled();
    });
  });
});
