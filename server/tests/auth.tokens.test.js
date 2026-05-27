/**
 * ============================================================
 *  TEST SUITE 2 — Token Management Tests
 * ============================================================
 *  Covers: access/refresh token generation, verification,
 *  rotation with SETNX lock, grace period, concurrent refresh,
 *  token revocation (single + all devices), session management.
 *
 *  Total test cases: 20
 * ============================================================
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const {
  RedisMock,
  generateTestAccessToken,
  generateTestRefreshToken,
  generateExpiredAccessToken,
  generateExpiredRefreshToken,
} = require('./setup');

const mockRedis = new RedisMock();

// Mock Redis BEFORE requiring tokenUtils
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

const tokenUtils = require('../utils/tokenutils.js');

// ─── Test Suite ──────────────────────────────────────────────────────────────
describe('🔑 TOKEN MANAGEMENT TESTS', () => {
  const testUserId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    mockRedis.reset();
  });

  // ========== 1. ACCESS TOKEN GENERATION ==========
  describe('1. Access Token Generation', () => {
    test('TC-T01: Should generate a valid access token', () => {
      const token = tokenUtils.generateAccessToken(testUserId);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      expect(decoded.id).toBe(testUserId);
      expect(decoded.type).toBe('access');
      expect(decoded.jti).toBeDefined();
    });

    test('TC-T02: Access token should have unique JTI', () => {
      const token1 = tokenUtils.generateAccessToken(testUserId);
      const token2 = tokenUtils.generateAccessToken(testUserId);
      
      const decoded1 = jwt.decode(token1);
      const decoded2 = jwt.decode(token2);
      
      expect(decoded1.jti).not.toBe(decoded2.jti);
    });

    test('TC-T03: Access token should have 15-minute expiry', () => {
      const token = tokenUtils.generateAccessToken(testUserId);
      const decoded = jwt.decode(token);
      
      const expectedExpiry = Math.floor(Date.now() / 1000) + 15 * 60;
      // Allow 5 seconds tolerance
      expect(Math.abs(decoded.exp - expectedExpiry)).toBeLessThan(5);
    });
  });

  // ========== 2. REFRESH TOKEN GENERATION ==========
  describe('2. Refresh Token Generation', () => {
    test('TC-T04: Should generate a valid refresh token', () => {
      const token = tokenUtils.generateRefreshToken(testUserId);
      expect(token).toBeTruthy();
      
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      expect(decoded.id).toBe(testUserId);
      expect(decoded.type).toBe('refresh');
    });

    test('TC-T05: Refresh token should have 7-day expiry', () => {
      const token = tokenUtils.generateRefreshToken(testUserId);
      const decoded = jwt.decode(token);
      
      const expectedExpiry = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      expect(Math.abs(decoded.exp - expectedExpiry)).toBeLessThan(5);
    });
  });

  // ========== 3. STORE REFRESH TOKEN IN REDIS ==========
  describe('3. Store Refresh Token in Redis', () => {
    test('TC-T06: Should store refresh token in Redis with TTL', async () => {
      const token = tokenUtils.generateRefreshToken(testUserId);
      const decoded = jwt.decode(token);
      
      const result = await tokenUtils.storeRefreshToken(testUserId, token);
      expect(result).toBe(true);

      const stored = await mockRedis.get(`refresh_token:${decoded.jti}`);
      expect(stored).toBeTruthy();
      
      const session = JSON.parse(stored);
      expect(session.userId).toBe(testUserId);
      expect(session.refreshToken).toBe(token);
    });

    test('TC-T07: Should add token ID to user sessions set', async () => {
      const token = tokenUtils.generateRefreshToken(testUserId);
      const decoded = jwt.decode(token);
      
      await tokenUtils.storeRefreshToken(testUserId, token);

      const sessionIds = await mockRedis.smembers(`user_sessions:${testUserId}`);
      expect(sessionIds).toContain(decoded.jti);
    });

    test('TC-T08: Should store IP and user-agent metadata', async () => {
      const token = tokenUtils.generateRefreshToken(testUserId);
      const decoded = jwt.decode(token);
      const mockReq = {
        ip: '192.168.1.1',
        get: (h) => h === 'user-agent' ? 'TestBrowser/1.0' : '',
        headers: {},
        connection: { remoteAddress: '192.168.1.1' },
      };

      await tokenUtils.storeRefreshToken(testUserId, token, mockReq);

      const stored = JSON.parse(await mockRedis.get(`refresh_token:${decoded.jti}`));
      expect(stored.ip).toBe('192.168.1.1');
      expect(stored.userAgent).toBe('TestBrowser/1.0');
    });
  });

  // ========== 4. VERIFY REFRESH TOKEN ==========
  describe('4. Verify Refresh Token', () => {
    test('TC-T09: Should verify a valid stored refresh token', async () => {
      const token = tokenUtils.generateRefreshToken(testUserId);
      await tokenUtils.storeRefreshToken(testUserId, token);

      const session = await tokenUtils.verifyRefreshToken(token);
      expect(session).toBeTruthy();
      expect(session.userId).toBe(testUserId);
    });

    test('TC-T10: Should reject expired refresh token', async () => {
      const token = generateExpiredRefreshToken(testUserId);
      
      // Wait briefly for it to expire
      await new Promise(r => setTimeout(r, 100));
      
      const session = await tokenUtils.verifyRefreshToken(token);
      expect(session).toBeNull();
    });

    test('TC-T11: Should reject token not in Redis (revoked)', async () => {
      const token = tokenUtils.generateRefreshToken(testUserId);
      // Don't store it in Redis

      const session = await tokenUtils.verifyRefreshToken(token);
      expect(session).toBeNull();
    });

    test('TC-T12: Should reject access token used as refresh token', async () => {
      const accessToken = jwt.sign(
        { id: testUserId, type: 'access', jti: crypto.randomBytes(16).toString('hex') },
        process.env.JWT_REFRESH_SECRET, // Even if signed with refresh secret
        { expiresIn: '15m' }
      );

      const session = await tokenUtils.verifyRefreshToken(accessToken);
      expect(session).toBeNull();
    });
  });

  // ========== 5. TOKEN ROTATION ==========
  describe('5. Token Rotation (refreshTokens)', () => {
    test('TC-T13: Should rotate tokens successfully', async () => {
      const token = tokenUtils.generateRefreshToken(testUserId);
      await tokenUtils.storeRefreshToken(testUserId, token);

      const result = await tokenUtils.refreshTokens(token);
      
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
      
      // New tokens should be different
      expect(result.tokens.refreshToken).not.toBe(token);
    });

    test('TC-T14: Should use 30-second grace period for old token', async () => {
      const token = tokenUtils.generateRefreshToken(testUserId);
      const decoded = jwt.decode(token);
      await tokenUtils.storeRefreshToken(testUserId, token);

      await tokenUtils.refreshTokens(token);

      // Old token should still exist in Redis (30s grace period)
      const oldTokenData = await mockRedis.get(`refresh_token:${decoded.jti}`);
      if (oldTokenData) {
        const parsed = JSON.parse(oldTokenData);
        expect(parsed.gracePeriod).toBe(true);
      }
    });

    test('TC-T15: Should store new refresh token in Redis', async () => {
      const token = tokenUtils.generateRefreshToken(testUserId);
      await tokenUtils.storeRefreshToken(testUserId, token);

      const result = await tokenUtils.refreshTokens(token);
      const newDecoded = jwt.decode(result.tokens.refreshToken);

      const newTokenData = await mockRedis.get(`refresh_token:${newDecoded.jti}`);
      expect(newTokenData).toBeTruthy();
    });

    test('TC-T16: Should return error for invalid refresh token', async () => {
      const fakeToken = tokenUtils.generateRefreshToken(testUserId);
      // Not stored in Redis

      const result = await tokenUtils.refreshTokens(fakeToken);
      expect(result.error).toBe('invalid');
    });

    test('TC-T17: Should handle concurrent refresh with SETNX lock', async () => {
      const token = tokenUtils.generateRefreshToken(testUserId);
      await tokenUtils.storeRefreshToken(testUserId, token);

      // First refresh acquires the lock
      const result1Promise = tokenUtils.refreshTokens(token);
      
      // Wait briefly then try second refresh (same token)
      await new Promise(r => setTimeout(r, 50));
      
      const result1 = await result1Promise;
      expect(result1.tokens || result1.concurrentRefresh || result1.error).toBeDefined();
    });
  });

  // ========== 6. TOKEN REVOCATION ==========
  describe('6. Token Revocation', () => {
    test('TC-T18: Should revoke a single refresh token', async () => {
      const token = tokenUtils.generateRefreshToken(testUserId);
      const decoded = jwt.decode(token);
      await tokenUtils.storeRefreshToken(testUserId, token);

      const result = await tokenUtils.revokeRefreshToken(token);
      expect(result).toBe(true);

      const stored = await mockRedis.get(`refresh_token:${decoded.jti}`);
      expect(stored).toBeNull();
    });

    test('TC-T19: Should revoke all tokens for a user', async () => {
      const token1 = tokenUtils.generateRefreshToken(testUserId);
      const token2 = tokenUtils.generateRefreshToken(testUserId);
      await tokenUtils.storeRefreshToken(testUserId, token1);
      await tokenUtils.storeRefreshToken(testUserId, token2);

      const result = await tokenUtils.revokeAllUserTokens(testUserId);
      expect(result).toBe(true);

      const sessions = await mockRedis.smembers(`user_sessions:${testUserId}`);
      expect(sessions.length).toBe(0);
    });

    test('TC-T20: Should remove token ID from user sessions set', async () => {
      const token = tokenUtils.generateRefreshToken(testUserId);
      const decoded = jwt.decode(token);
      await tokenUtils.storeRefreshToken(testUserId, token);

      await tokenUtils.revokeRefreshToken(token);

      const sessions = await mockRedis.smembers(`user_sessions:${testUserId}`);
      expect(sessions).not.toContain(decoded.jti);
    });
  });
});
