/**
 * ============================================================
 *  TEST SETUP — Shared helpers, mocks, and configuration
 * ============================================================
 *  This file provides mock factories and utilities used across
 *  all authentication test suites. It eliminates the need for
 *  a live MongoDB / Redis connection so tests run fast & isolated.
 * ============================================================
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const argon2 = require('argon2');

// ─── Environment defaults (tests should never hit real services) ─────────────
process.env.JWT_SECRET = 'test-jwt-secret-key-for-unit-tests';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_ACCESS_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';
process.env.NODE_ENV = 'test';
process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';
// Disable RabbitMQ in tests — prevents real connection attempts
delete process.env.RABBITMQ_URL;

// ─── Redis Mock ──────────────────────────────────────────────────────────────
class RedisMock {
  constructor() {
    this.store = new Map();
    this.sets = new Map();
    this.ttls = new Map();
  }

  async ping() { return 'PONG'; }

  async setex(key, ttl, value) {
    this.store.set(key, value);
    this.ttls.set(key, Date.now() + ttl * 1000);
    return 'OK';
  }

  async set(key, value, options = {}) {
    if (options.nx) {
      if (this.store.has(key)) return null; // NX: only set if not exists
    }
    this.store.set(key, value);
    if (options.ex) {
      this.ttls.set(key, Date.now() + options.ex * 1000);
    }
    return 'OK';
  }

  async get(key) {
    if (this.ttls.has(key) && Date.now() > this.ttls.get(key)) {
      this.store.delete(key);
      this.ttls.delete(key);
      return null;
    }
    return this.store.get(key) || null;
  }

  async del(key) {
    this.store.delete(key);
    this.sets.delete(key);
    this.ttls.delete(key);
    return 1;
  }

  async exists(key) {
    if (this.ttls.has(key) && Date.now() > this.ttls.get(key)) {
      this.store.delete(key);
      this.ttls.delete(key);
      return 0;
    }
    return this.store.has(key) ? 1 : 0;
  }

  async ttl(key) {
    if (!this.ttls.has(key)) return -2;
    const remaining = Math.ceil((this.ttls.get(key) - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async incr(key) {
    const val = parseInt(this.store.get(key) || '0', 10) + 1;
    this.store.set(key, String(val));
    return val;
  }

  async expire(key, seconds) {
    this.ttls.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async sadd(key, ...members) {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    members.forEach(m => this.sets.get(key).add(m));
    return members.length;
  }

  async srem(key, ...members) {
    if (!this.sets.has(key)) return 0;
    let removed = 0;
    members.forEach(m => { if (this.sets.get(key).delete(m)) removed++; });
    return removed;
  }

  async smembers(key) {
    if (!this.sets.has(key)) return [];
    return Array.from(this.sets.get(key));
  }

  async scan(cursor, options = {}) {
    const match = options.match || '*';
    const regex = new RegExp('^' + match.replace(/\*/g, '.*') + '$');
    const keys = [];
    for (const k of this.store.keys()) {
      if (regex.test(k)) keys.push(k);
    }
    return ['0', keys];
  }

  reset() {
    this.store.clear();
    this.sets.clear();
    this.ttls.clear();
  }
}

// ─── Mongoose / User Model Mock ──────────────────────────────────────────────
const createMockUser = (overrides = {}) => {
  const defaultPassword = '$argon2id$v=19$m=65536,t=3,p=4$1s0ru9jWhj6+CZpCuENHZg$w9oPnMIpH0CtNGFRuyeHlsjNL8sytvmrDh8y5reaew4'; // "Test@1234"
  
  const user = {
    _id: overrides._id || '507f1f77bcf86cd799439011',
    name: overrides.name || 'Test User',
    email: overrides.email || 'test@example.com',
    password: 'password' in overrides ? overrides.password : defaultPassword,
    role: overrides.role || 'user',
    provider: overrides.provider || 'local',
    isVerified: overrides.isVerified !== undefined ? overrides.isVerified : true,
    status: overrides.status || 'active',
    avatar: overrides.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    profileImage: overrides.profileImage || null,
    profileImageKey: overrides.profileImageKey || null,
    googleProfileImage: overrides.googleProfileImage || null,
    loginAttempts: overrides.loginAttempts || 0,
    lockUntil: overrides.lockUntil || undefined,
    devices: overrides.devices || [],
    loginHistory: overrides.loginHistory || [],
    securityLogs: overrides.securityLogs || [],
    passwordHistory: overrides.passwordHistory || [],
    lastPasswordChange: overrides.lastPasswordChange || new Date(),
    preferences: overrides.preferences || { twoFactorAuth: false },
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
    // Methods
    comparePassword: jest.fn(async (candidate) => argon2.verify(user.password, candidate)),
    isLocked: jest.fn(() => !!(user.lockUntil && user.lockUntil > Date.now())),
    incrementLoginAttempts: jest.fn(async () => {
      user.loginAttempts += 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 60 * 60 * 1000;
      }
    }),
    resetLoginAttempts: jest.fn(async () => { user.loginAttempts = 0; user.lockUntil = undefined; }),
    addLoginHistory: jest.fn(async () => {}),
    addSecurityLog: jest.fn(async () => {}),
    updateDeviceSession: jest.fn(async () => {}),
    deactivateSession: jest.fn(async () => {}),
    getProfileImage: jest.fn(() => user.profileImage || user.googleProfileImage || user.avatar),
    passwordNeedsChange: jest.fn(() => ({ needsChange: false, daysRemaining: 80 })),
    addToPasswordHistory: jest.fn(async () => {}),
    isPasswordInHistory: jest.fn(async () => ({ inHistory: false })),
    updateLastLogin: jest.fn(async () => {}),
    save: jest.fn(async () => user),
    toJSON: jest.fn(() => ({ ...user })),
    select: jest.fn(function() { return this; }),
  };

  return user;
};

// ─── Token Helpers ───────────────────────────────────────────────────────────
const generateTestAccessToken = (userId, options = {}) => {
  return jwt.sign(
    { id: userId, type: 'access', jti: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: options.expiresIn || '15m' }
  );
};

const generateTestRefreshToken = (userId, options = {}) => {
  return jwt.sign(
    { id: userId, type: 'refresh', jti: options.jti || crypto.randomBytes(16).toString('hex') },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: options.expiresIn || '7d' }
  );
};

const generateExpiredAccessToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'access', jti: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '0s' }
  );
};

const generateExpiredRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'refresh', jti: crypto.randomBytes(16).toString('hex') },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '0s' }
  );
};

// ─── Express mock helpers ────────────────────────────────────────────────────
const createMockReq = (overrides = {}) => ({
  body: overrides.body || {},
  params: overrides.params || {},
  query: overrides.query || {},
  cookies: overrides.cookies || {},
  headers: overrides.headers || {},
  ip: overrides.ip || '127.0.0.1',
  user: overrides.user || null,
  get: jest.fn((header) => {
    const headers = {
      'user-agent': 'jest-test-agent/1.0',
      ...overrides.headers,
    };
    return headers[header.toLowerCase()] || '';
  }),
  connection: { remoteAddress: '127.0.0.1' },
});

const createMockRes = () => {
  const res = {
    statusCode: 200,
    _json: null,
    _cookies: {},
    _clearedCookies: [],
    _headers: {},
    status: jest.fn(function (code) { this.statusCode = code; return this; }),
    json: jest.fn(function (data) { this._json = data; return this; }),
    setHeader: jest.fn(function (name, value) { this._headers[name] = value; return this; }),
    cookie: jest.fn(function (name, value, options) {
      this._cookies[name] = { value, options };
      return this;
    }),
    clearCookie: jest.fn(function (name, options) {
      this._clearedCookies.push(name);
      delete this._cookies[name];
      return this;
    }),
  };
  return res;
};

// ─── Password helpers ────────────────────────────────────────────────────────
const STRONG_PASSWORD = 'SecureP@ss1!';
const WEAK_PASSWORD = '123';
const VALID_EMAIL = 'testuser@example.com';
const VALID_NAME = 'Test User';

const hashPassword = async (plain) => {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
};

module.exports = {
  RedisMock,
  createMockUser,
  createMockReq,
  createMockRes,
  generateTestAccessToken,
  generateTestRefreshToken,
  generateExpiredAccessToken,
  generateExpiredRefreshToken,
  hashPassword,
  STRONG_PASSWORD,
  WEAK_PASSWORD,
  VALID_EMAIL,
  VALID_NAME,
};
