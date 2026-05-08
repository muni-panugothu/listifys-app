const mongoose = require('mongoose');
const { createMockReq, createMockRes } = require('./setup');

// ─── MOCK DEPENDENCIES ──────────────────────────────────────────────
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), productLog: jest.fn(), securityLog: jest.fn() }
}));

jest.mock('../config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(0),
  _stub: true,
}));

jest.mock('../services/listingcache.service', () => ({
  getCachedListingList: jest.fn().mockResolvedValue(null),
  getCachedListing: jest.fn().mockResolvedValue(null),
  cacheListingList: jest.fn().mockResolvedValue(undefined),
  cacheListing: jest.fn().mockResolvedValue(undefined),
  prefetchCategoryListings: jest.fn().mockResolvedValue(undefined),
  cacheSearchResults: jest.fn().mockResolvedValue(undefined),
  invalidateListCaches: jest.fn().mockResolvedValue(undefined),
  invalidateListingCache: jest.fn().mockResolvedValue(undefined),
  logProductSaved: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/s3.service', () => ({
  toProxyUrl: jest.fn(url => url),
  deleteImage: jest.fn().mockResolvedValue(true),
  deleteImagesByUrls: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/viewcount.service', () => ({ recordView: jest.fn().mockResolvedValue(true) }));
jest.mock('../services/search.service', () => ({ indexListing: jest.fn().mockResolvedValue(true), deleteListing: jest.fn().mockResolvedValue(true) }));
jest.mock('../services/notifyfollowers.service', () => ({ notifyFollowersOfNewListing: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../utils/geoQuery', () => ({
  applyGeoFilter: jest.fn(),
  buildSortOption: jest.fn(() => ({ createdAt: -1 })),
}));

jest.mock('../queues/producers/listing.producer', () => ({
  publishListingCreated: jest.fn().mockResolvedValue(true),
  publishListingUpdated: jest.fn().mockResolvedValue(true),
  publishListingDeleted: jest.fn().mockResolvedValue(true),
  publishImageCleanup: jest.fn().mockResolvedValue(true),
}));

const mockPaginatedFind = jest.fn();
jest.mock('../utils/pagination', () => ({
  parsePagination: jest.fn((query, defaults) => {
    const limit = Number(query?.limit) || defaults?.limit || 20;
    const page = Number(query?.page) || 1;
    return { page, limit, skip: (page - 1) * limit };
  }),
  paginatedFind: mockPaginatedFind,
}));

// Mock Model
const mockFind = jest.fn();
const mockCountDocuments = jest.fn();
const mockFindByIdResult = jest.fn();
const mockFindOneResult = jest.fn();

jest.mock('../models/fashion.model', () => {
  return {
    find: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: mockFind,
    })),
    countDocuments: mockCountDocuments,
    findById: jest.fn(() => ({
      populate: jest.fn().mockResolvedValue(mockFindByIdResult()),
    })),
    findOne: jest.fn(() => ({
      populate: jest.fn().mockResolvedValue(mockFindOneResult()),
    })),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(() => ({ lean: jest.fn() })),
  };
});

const controller = require('../controllers/fashion.controller');

// ─── TEST SUITE ─────────────────────────────────────────────────────────────
describe('👗 FASHION CONTROLLER TESTS', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = createMockReq();
    res = createMockRes();
  });

  // ── 1. getAllFashion (Public) ──────────────────────────────────────
  describe('1. getAllFashion (Public)', () => {
    test('TC-FA01: Should fetch paginated listings successfully', async () => {
      req.query = { page: 1, limit: 10 };
      const mockListings = [
        { _id: '1', title: 'Designer Jacket', images: ['img1.jpg'] },
        { _id: '2', title: 'Silk Saree', images: ['img2.jpg'] },
      ];
      mockFind.mockResolvedValue(mockListings);
      mockCountDocuments.mockResolvedValue(2);

      await controller.getAllFashion(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.listings.length).toBe(2);
      expect(res._json.pagination.total).toBe(2);
    });

    test('TC-FA02: Should apply subcategory filter', async () => {
      req.query = { subcategory: 'Men' };
      mockFind.mockResolvedValue([]);
      mockCountDocuments.mockResolvedValue(0);

      await controller.getAllFashion(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
    });

    test('TC-FA03: Should handle empty results gracefully', async () => {
      req.query = {};
      mockFind.mockResolvedValue([]);
      mockCountDocuments.mockResolvedValue(0);

      await controller.getAllFashion(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.listings).toEqual([]);
    });

    test('TC-FA04: Should return 500 on database error', async () => {
      mockFind.mockRejectedValue(new Error('Database error'));
      await controller.getAllFashion(req, res);

      expect(res.statusCode).toBe(500);
      expect(res._json.success).toBe(false);
    });
  });

  // ── 2. getFashionById (Public) ────────────────────────────────────
  describe('2. getFashionById (Public)', () => {
    test('TC-FA05: Should return 404 for non-existent slug', async () => {
      req.params = { id: 'nonexistent-slug' };
      mockFindOneResult.mockReturnValue(null);

      await controller.getFashionById(req, res);

      expect(res.statusCode).toBe(404);
      expect(res._json.success).toBe(false);
    });

    test('TC-FA06: Should return 404 if listing not found by ObjectId', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      mockFindByIdResult.mockReturnValue(null);

      await controller.getFashionById(req, res);

      expect(res.statusCode).toBe(404);
      expect(res._json.success).toBe(false);
    });

    test('TC-FA07: Should return listing if valid ID provided', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      req.params = { id };
      const mockListing = {
        _id: id, title: 'Silk Saree', images: ['img.jpg'], status: 'active',
        toObject: function () { return { ...this }; },
      };
      mockFindByIdResult.mockReturnValue(mockListing);

      await controller.getFashionById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.listing.title).toBe('Silk Saree');
    });
  });

  // ── 3. getMyFashion (Protected) ───────────────────────────────────
  describe('3. getMyFashion (Protected)', () => {
    test('TC-FA08: Should return listings for the authenticated user', async () => {
      req.user = { _id: 'user-123' };
      const mockUserListings = [{ _id: '1', title: 'My Jacket', images: [] }];

      mockPaginatedFind.mockResolvedValue({
        items: mockUserListings,
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      });

      await controller.getMyFashion(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.listings[0].title).toBe('My Jacket');
    });
  });

  // ── 4. deleteFashion (Protected) ──────────────────────────────────
  describe('4. deleteFashion (Protected)', () => {
    test('TC-FA09: Should return 400 for invalid ObjectId', async () => {
      req.params = { id: 'not-valid' };
      req.user = { _id: 'user-123' };

      await controller.deleteFashion(req, res);

      expect(res.statusCode).toBe(400);
    });

    test('TC-FA10: Should return 404 if listing does not exist', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      req.params = { id };
      req.user = { _id: 'user-123' };

      const Model = require('../models/fashion.model');
      Model.findById.mockResolvedValueOnce(null);

      await controller.deleteFashion(req, res);

      expect(res.statusCode).toBe(404);
    });

    test('TC-FA11: Should delete listing if user owns it', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      req.params = { id };
      req.user = { _id: 'user-123' };

      const mockListing = {
        _id: id, seller: { toString: () => 'user-123' }, images: [],
        toObject: function () { return { ...this }; },
        deleteOne: jest.fn().mockResolvedValue(true),
      };
      const Model = require('../models/fashion.model');
      Model.findById.mockResolvedValueOnce(mockListing);

      await controller.deleteFashion(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(mockListing.deleteOne).toHaveBeenCalled();
    });

    test('TC-FA12: Should forbid deletion if user is not the owner', async () => {
      const id = new mongoose.Types.ObjectId().toString();
      req.params = { id };
      req.user = { _id: 'hacker-456' };

      const mockListing = {
        _id: id, seller: { toString: () => 'user-123' }, images: [],
        toObject: function () { return { ...this }; },
        deleteOne: jest.fn(),
      };
      const Model = require('../models/fashion.model');
      Model.findById.mockResolvedValueOnce(mockListing);

      await controller.deleteFashion(req, res);

      expect(res.statusCode).toBe(403);
      expect(res._json.success).toBe(false);
      expect(res._json.message).toMatch(/authorized/i);
    });
  });
});
