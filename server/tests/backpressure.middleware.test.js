const { createMockReq, createMockRes } = require('./setup');

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

const { backpressureMiddleware, getBackpressureStats } = require('../middleware/backpressure.middleware');

describe('⚡ BACKPRESSURE MIDDLEWARE TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = createMockReq();
    req.path = '/api/test';
    req.originalUrl = '/api/test';
    res = createMockRes();
    next = jest.fn();
  });

  test('TC-BP01: Should call next under normal load', () => {
    backpressureMiddleware(req, res, next);
    // During warmup or normal load, should pass through
    expect(next).toHaveBeenCalled();
  });

  test('TC-BP02: Should always pass health check requests', () => {
    req.path = '/health';
    req.originalUrl = '/health';
    backpressureMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('TC-BP03: Should always pass critical auth paths', () => {
    const criticalPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/google'];
    criticalPaths.forEach(path => {
      const cReq = createMockReq();
      cReq.path = path;
      cReq.originalUrl = path;
      const cRes = createMockRes();
      const cNext = jest.fn();
      backpressureMiddleware(cReq, cRes, cNext);
      expect(cNext).toHaveBeenCalled();
    });
  });

  test('TC-BP04: getBackpressureStats should return expected shape', () => {
    const stats = getBackpressureStats();
    expect(stats).toHaveProperty('eventLoopLagMs');
    expect(stats).toHaveProperty('isOverloaded');
    expect(stats).toHaveProperty('shedCount');
    expect(typeof stats.eventLoopLagMs).toBe('string'); // .toFixed(1) returns string
    expect(typeof stats.isOverloaded).toBe('boolean');
  });

  test('TC-BP05: Should pass booking requests as critical', () => {
    req.path = '/api/services/bookings';
    req.originalUrl = '/api/services/bookings';
    backpressureMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
