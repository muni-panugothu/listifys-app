const { createMockReq, createMockRes } = require('./setup');

// ─── MOCK DEPENDENCIES ──────────────────────────────────────────────
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), securityLog: jest.fn() }
}));

const securityMiddleware = require('../middleware/security.middleware');

describe('🛡️ SECURITY MIDDLEWARE TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = createMockReq();
    req.path = '/api/test';
    req.method = 'GET';
    req.originalUrl = '/api/test';
    res = createMockRes();
    res.removeHeader = jest.fn();
    next = jest.fn();
  });

  test('TC-SM01: Should set security headers', () => {
    securityMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '0');
    expect(next).toHaveBeenCalled();
  });

  test('TC-SM02: Should remove X-Powered-By header', () => {
    securityMiddleware(req, res, next);
    expect(res.removeHeader).toHaveBeenCalledWith('X-Powered-By');
  });

  test('TC-SM03: Should block path traversal attacks', () => {
    req.path = '/api/../../../etc/passwd';
    securityMiddleware(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('TC-SM04: Should block encoded path traversal', () => {
    req.path = '/api/%2e%2e/etc/passwd';
    req.originalUrl = '/api/%2e%2e/etc/passwd';
    securityMiddleware(req, res, next);
    expect(res.statusCode).toBe(400);
  });

  test('TC-SM05: Should block known attack tools', () => {
    req.headers = { 'user-agent': 'sqlmap/1.5' };
    req.get = jest.fn((h) => {
      if (h.toLowerCase() === 'user-agent') return 'sqlmap/1.5';
      return '';
    });
    securityMiddleware(req, res, next);
    expect(res.statusCode).toBe(403);
  });

  test('TC-SM06: Should set no-cache for auth routes', () => {
    req.path = '/api/auth/check';
    req.originalUrl = '/api/auth/check';
    securityMiddleware(req, res, next);

    const cacheHeaders = res.setHeader.mock.calls.filter(([name]) => name === 'Cache-Control');
    const noStoreSet = cacheHeaders.some(([, val]) => val.includes('no-store'));
    expect(noStoreSet).toBe(true);
  });

  test('TC-SM07: Should allow legitimate requests', () => {
    req.path = '/api/electronics';
    req.originalUrl = '/api/electronics';
    req.method = 'GET';
    securityMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('TC-SM08: Should reject oversized payloads on non-upload routes', () => {
    req.path = '/api/auth/login';
    req.headers['content-length'] = String(15 * 1024 * 1024); // 15MB
    req.get = jest.fn((h) => {
      if (h.toLowerCase() === 'content-length') return String(15 * 1024 * 1024);
      if (h.toLowerCase() === 'user-agent') return 'jest-test-agent/1.0';
      return '';
    });
    securityMiddleware(req, res, next);
    expect(res.statusCode).toBe(413);
  });

  test('TC-SM09: Should allow larger payloads on upload routes', () => {
    req.path = '/api/electronics/upload';
    req.originalUrl = '/api/electronics/upload';
    req.method = 'POST';
    req.headers['content-length'] = String(50 * 1024 * 1024); // 50MB
    req.get = jest.fn((h) => {
      if (h.toLowerCase() === 'content-length') return String(50 * 1024 * 1024);
      if (h.toLowerCase() === 'user-agent') return 'jest-test-agent/1.0';
      return '';
    });
    securityMiddleware(req, res, next);
    // Should call next for upload routes < 70MB
    expect(next).toHaveBeenCalled();
  });

  test('TC-SM10: Should allow native app POST requests without origin or referer', () => {
    req.path = '/api/auth/login';
    req.originalUrl = '/api/auth/login';
    req.method = 'POST';
    req.headers = {
      'user-agent': 'Listify/1.0.0 (Samsung SM-G998B; Android 14)',
      cookie: 'refreshToken=abc123',
      accept: 'application/json',
      'content-type': 'application/json',
    };

    securityMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});
