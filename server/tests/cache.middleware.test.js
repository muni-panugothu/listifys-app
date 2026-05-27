const { createMockReq, createMockRes } = require('./setup');

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

jest.mock('../config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  sadd: jest.fn().mockResolvedValue(1),
  smembers: jest.fn().mockResolvedValue([]),
  _stub: true,
}));

const { buildListKey, buildDetailKey, invalidateEntityCache } = require('../middleware/cache.middleware');

describe('💾 CACHE MIDDLEWARE TESTS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. buildListKey', () => {
    test('TC-CA01: Should build deterministic list key', () => {
      const key = buildListKey('electronics', { page: '1', limit: '20' });
      expect(key).toContain('cache:electronics:list:');
      expect(typeof key).toBe('string');
    });

    test('TC-CA02: Should produce same key regardless of query param order', () => {
      const key1 = buildListKey('electronics', { page: '1', limit: '20', sort: 'newest' });
      const key2 = buildListKey('electronics', { sort: 'newest', page: '1', limit: '20' });
      expect(key1).toBe(key2);
    });

    test('TC-CA03: Should produce different keys for different entities', () => {
      const key1 = buildListKey('electronics', { page: '1' });
      const key2 = buildListKey('vehicles', { page: '1' });
      expect(key1).not.toBe(key2);
    });
  });

  describe('2. buildDetailKey', () => {
    test('TC-CA04: Should build correct detail key', () => {
      const key = buildDetailKey('electronics', '507f1f77bcf86cd799439011');
      expect(key).toBe('cache:electronics:detail:507f1f77bcf86cd799439011');
    });

    test('TC-CA05: Should include entity and id in key', () => {
      const key = buildDetailKey('vehicles', 'abc123');
      expect(key).toContain('vehicles');
      expect(key).toContain('abc123');
    });
  });

  describe('3. invalidateEntityCache', () => {
    test('TC-CA06: Should call redis del for specific entity detail', async () => {
      const redis = require('../config/redis');
      await invalidateEntityCache('electronics', '507f1f77bcf86cd799439011');
      expect(redis.del).toHaveBeenCalled();
    });

    test('TC-CA07: Should handle entity without id (list invalidation)', async () => {
      const redis = require('../config/redis');
      await invalidateEntityCache('electronics');
      // Should try to clear list caches via smembers + del
      expect(redis.smembers).toHaveBeenCalled();
    });
  });
});
