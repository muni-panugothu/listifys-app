/**
 * ============================================================
 *  TEST SUITE 5 — Registration & OTP Flow Tests
 * ============================================================
 *  Covers: initiateRegister, verifyOTPAndRegister, resendOTP,
 *  input validation, duplicate email, OTP rate limiting,
 *  OTP blocking, email service failure handling.
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
  STRONG_PASSWORD,
  WEAK_PASSWORD,
  VALID_EMAIL,
  VALID_NAME,
} = require('./setup');

const mockRedis = new RedisMock();

// Mocks
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

const mockSendOTPEmail = jest.fn().mockResolvedValue(true);
jest.mock('../services/email.service', () => ({
  sendOTPEmail: (...args) => mockSendOTPEmail(...args),
  sendForgotPasswordOTPEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetSuccessEmail: jest.fn().mockResolvedValue(true),
  sendLoginNotificationEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/device.service', () => ({
  createDeviceSession: jest.fn(() => ({ deviceId: 'test', deviceName: 'Test', sessions: [] })),
  formatDeviceForDisplay: jest.fn(d => d),
}));

// Mock RedisService with controllable methods
const mockRedisService = {
  getPendingRegistration: jest.fn().mockResolvedValue(null),
  storePendingRegistration: jest.fn().mockResolvedValue(true),
  deletePendingRegistration: jest.fn().mockResolvedValue(true),
  storeOTP: jest.fn().mockResolvedValue(true),
  deleteOTP: jest.fn().mockResolvedValue(true),
  verifyOTP: jest.fn().mockResolvedValue({ valid: true }),
  checkEmailBlocked: jest.fn().mockResolvedValue(false),
  incrementRegistrationAttempts: jest.fn().mockResolvedValue(true),
  checkOTPBlocked: jest.fn().mockResolvedValue({ blocked: false }),
  incrementOTPAttempts: jest.fn().mockResolvedValue({ attempts: 1, blocked: false }),
  clearOTPAttempts: jest.fn().mockResolvedValue(true),
  clearOTPBlock: jest.fn().mockResolvedValue(true),
  getCachedProfileImage: jest.fn().mockResolvedValue(null),
  cacheProfileImage: jest.fn().mockResolvedValue(true),
};
jest.mock('../services/redis.service', () => mockRedisService);

jest.mock('../services/googleAuth.OAuth', () => ({
  handleGoogleAuth: jest.fn(),
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

const mockUserFindOne = jest.fn();
const mockUserFindById = jest.fn();
const mockCreateUser = createMockUser; // alias with mock prefix for jest.mock scope
jest.mock('../models/user.model', () => {
  const M = jest.fn(function(data) {
    return {
      ...mockCreateUser(data),
      save: jest.fn().mockResolvedValue(true),
    };
  });
  M.findOne = (...args) => mockUserFindOne(...args);
  M.findById = (...args) => mockUserFindById(...args);
  M.create = jest.fn();
  M.findByIdAndUpdate = jest.fn();
  return M;
});

const authController = require('../controllers/auth.controller');

// ─── Test Suite ──────────────────────────────────────────────────────────────
describe('📝 REGISTRATION & OTP FLOW TESTS', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.reset();
    req = createMockReq();
    res = createMockRes();
    mockRedisService.getPendingRegistration.mockResolvedValue(null);
    mockRedisService.checkEmailBlocked.mockResolvedValue(false);
    mockRedisService.checkOTPBlocked.mockResolvedValue({ blocked: false });
    mockValidatePassword.mockResolvedValue({ isValid: true, errors: [], strength: 85, breach: { found: false } });
    mockSendOTPEmail.mockResolvedValue(true);
  });

  // ========== 1. INITIATE REGISTRATION ==========
  describe('1. Initiate Registration', () => {
    test('TC-R01: Should reject registration with missing fields', async () => {
      req.body = { email: VALID_EMAIL }; // Missing name, password
      await authController.initiateRegister(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.success).toBe(false);
    });

    test('TC-R02: Should reject registration with invalid email format', async () => {
      req.body = {
        name: VALID_NAME,
        email: 'not-an-email',
        password: STRONG_PASSWORD,
      };

      await authController.initiateRegister(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.message).toMatch(/valid email/i);
    });

    test('TC-R03: Should accept registration without confirmPassword', async () => {
      mockUserFindOne.mockResolvedValue(null);

      req.body = {
        name: VALID_NAME,
        email: VALID_EMAIL,
        password: STRONG_PASSWORD,
      };

      await authController.initiateRegister(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
    });

    test('TC-R04: Should reject registration with weak password', async () => {
      mockValidatePassword.mockResolvedValue({
        isValid: false,
        errors: ['Password too weak'],
        strength: 10,
      });

      req.body = {
        name: VALID_NAME,
        email: VALID_EMAIL,
        password: WEAK_PASSWORD,
      };

      await authController.initiateRegister(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.message).toMatch(/security requirements/i);
    });

    test('TC-R05: Should return generic success if user already exists', async () => {
      mockUserFindOne.mockResolvedValue(createMockUser());
      
      req.body = {
        name: VALID_NAME,
        email: VALID_EMAIL,
        password: STRONG_PASSWORD,
      };

      await authController.initiateRegister(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.message).toMatch(/otp sent/i);
    });

    test('TC-R06: Should return generic success if pending registration exists', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockRedisService.getPendingRegistration.mockResolvedValue({
        email: VALID_EMAIL,
        createdAt: new Date().toISOString(),
      });

      req.body = {
        name: VALID_NAME,
        email: VALID_EMAIL,
        password: STRONG_PASSWORD,
      };

      await authController.initiateRegister(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.message).toMatch(/otp sent/i);
    });

    test('TC-R07: Should reject if email is blocked (too many attempts)', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockRedisService.checkEmailBlocked.mockResolvedValue(true);

      req.body = {
        name: VALID_NAME,
        email: VALID_EMAIL,
        password: STRONG_PASSWORD,
      };

      await authController.initiateRegister(req, res);

      expect(res.statusCode).toBe(429);
    });

    test('TC-R08: Should initiate registration successfully', async () => {
      mockUserFindOne.mockResolvedValue(null);

      req.body = {
        name: VALID_NAME,
        email: VALID_EMAIL,
        password: STRONG_PASSWORD,
      };

      await authController.initiateRegister(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.email).toBe(VALID_EMAIL);
      expect(res._json.expiresIn).toBe(600);
      expect(mockRedisService.storePendingRegistration).toHaveBeenCalled();
      expect(mockRedisService.storeOTP).toHaveBeenCalled();
      // OTP is sent via RabbitMQ queue (publishOTPEmail), not direct email
      const { publishOTPEmail } = require('../queues/producers/auth.producer');
      expect(publishOTPEmail).toHaveBeenCalled();
    });

    test('TC-R09: Should still accept registration when email delivery fails in background', async () => {
      mockUserFindOne.mockResolvedValue(null);
      const { publishOTPEmail } = require('../queues/producers/auth.producer');
      publishOTPEmail.mockResolvedValueOnce(false);
      mockSendOTPEmail.mockRejectedValueOnce(new Error('SMTP error'));

      req.body = {
        name: VALID_NAME,
        email: VALID_EMAIL,
        password: STRONG_PASSWORD,
      };

      await authController.initiateRegister(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(mockRedisService.storePendingRegistration).toHaveBeenCalled();
      expect(mockRedisService.storeOTP).toHaveBeenCalled();
      expect(mockRedisService.deletePendingRegistration).not.toHaveBeenCalled();
      expect(mockRedisService.deleteOTP).not.toHaveBeenCalled();
    });
  });

  // ========== 2. VERIFY OTP AND REGISTER ==========
  describe('2. Verify OTP & Complete Registration', () => {
    test('TC-R10: Should reject with missing email or OTP', async () => {
      req.body = { email: VALID_EMAIL };
      await authController.verifyOTPAndRegister(req, res);

      expect(res.statusCode).toBe(400);
    });

    test('TC-R11: Should reject if OTP is blocked', async () => {
      mockRedisService.checkOTPBlocked.mockResolvedValue({
        blocked: true,
        remainingSeconds: 45,
      });

      req.body = { email: VALID_EMAIL, otp: '123456' };
      await authController.verifyOTPAndRegister(req, res);

      expect(res.statusCode).toBe(429);
    });

    test('TC-R12: Should reject if no pending registration', async () => {
      req.body = { email: VALID_EMAIL, otp: '123456' };
      await authController.verifyOTPAndRegister(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._json.message).toMatch(/expired or not found/i);
    });

    test('TC-R13: Should reject invalid OTP', async () => {
      mockRedisService.getPendingRegistration.mockResolvedValue({
        name: VALID_NAME,
        email: VALID_EMAIL,
        password: '$2a$12$hashedpassword',
      });
      mockRedisService.verifyOTP.mockResolvedValue({ valid: false, reason: 'Invalid OTP' });

      req.body = { email: VALID_EMAIL, otp: '999999' };
      await authController.verifyOTPAndRegister(req, res);

      expect(res.statusCode).toBe(400);
      expect(mockRedisService.incrementOTPAttempts).toHaveBeenCalled();
    });

    test('TC-R14: Should complete registration with valid OTP', async () => {
      mockRedisService.getPendingRegistration.mockResolvedValue({
        name: VALID_NAME,
        email: VALID_EMAIL,
        password: '$2a$12$hashedpassword',
      });
      mockRedisService.verifyOTP.mockResolvedValue({ valid: true });
      mockUserFindOne.mockResolvedValue(null);

      req.body = { email: VALID_EMAIL, otp: '123456' };
      await authController.verifyOTPAndRegister(req, res);

      expect(res.statusCode).toBe(201);
      expect(res._json.success).toBe(true);
      expect(mockRedisService.clearOTPAttempts).toHaveBeenCalled();
      expect(mockRedisService.deletePendingRegistration).toHaveBeenCalled();
    });
  });

  // ========== 3. RESEND OTP ==========
  describe('3. Resend OTP', () => {
    test('TC-R15: Should reject resend if OTP is blocked', async () => {
      mockRedisService.checkOTPBlocked.mockResolvedValue({
        blocked: true,
        remainingSeconds: 30,
      });

      req.body = { email: VALID_EMAIL };
      await authController.resendOTP(req, res);

      expect(res.statusCode).toBe(429);
    });

    test('TC-R16: Should reject resend if no pending registration', async () => {
      req.body = { email: VALID_EMAIL };
      await authController.resendOTP(req, res);

      expect(res.statusCode).toBe(400);
    });
  });
});
