const mongoose = require('mongoose');
const { createMockReq, createMockRes } = require('./setup');

// ─── MOCK DEPENDENCIES ──────────────────────────────────────────────
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    productLog: jest.fn(),
    securityLog: jest.fn(),
  }
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
}));

jest.mock('../services/s3.service', () => ({
  toProxyUrl: jest.fn(url => url),
  deleteImage: jest.fn().mockResolvedValue(true),
  deleteImagesByUrls: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/viewcount.service', () => ({
  recordView: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/search.service', () => ({
  indexListing: jest.fn().mockResolvedValue(true),
  deleteListing: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/notifyfollowers.service', () => ({
  notifyFollowersOfNewListing: jest.fn().mockResolvedValue(undefined),
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

// Mock Models
const mockForsaleFind = jest.fn();
const mockForsaleCountDocuments = jest.fn();
const mockForsaleFindByIdPopulate = jest.fn();
const mockForsaleCreate = jest.fn();
const mockForsaleFindByIdAndUpdate = jest.fn();
const mockForsaleFindByIdAndDelete = jest.fn();

jest.mock('../models/forsale.model', () => {
  const findByIdMock = jest.fn();
  findByIdMock.mockImplementation(() => ({
    populate: jest.fn().mockReturnThis(),
    lean: mockForsaleFindByIdPopulate,
  }));
  return {
    find: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: mockForsaleFind,
    })),
    countDocuments: mockForsaleCountDocuments,
    findById: findByIdMock,
    create: mockForsaleCreate,
    findByIdAndUpdate: jest.fn(() => ({
      lean: mockForsaleFindByIdAndUpdate,
    })),
    findByIdAndDelete: mockForsaleFindByIdAndDelete,
    findOne: jest.fn(() => ({
      populate: jest.fn().mockResolvedValue(null),
    })),
  };
});

// Controller to Test
const forsaleController = require('../controllers/forsale.controller');

// ─── TEST SUITE ─────────────────────────────────────────────────────────────
describe('🛠️ FOR SALE CONTROLLER TESTS', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = createMockReq();
    res = createMockRes();
  });

  describe('1. getListings (Public)', () => {
    test('TC-SL01: Should fetch paginated for-sale listings successfully', async () => {
      req.query = { page: 1, limit: 10 };

      const mockListings = [
        { _id: '1', title: 'Used Sofa', images: ['test.jpg'] },
        { _id: '2', title: 'Dining Table', images: ['test2.jpg'] }
      ];

      mockForsaleFind.mockResolvedValue(mockListings);
      mockForsaleCountDocuments.mockResolvedValue(2);

      await forsaleController.getAllForSale(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.listings.length).toBe(2);
      expect(res._json.pagination.total).toBe(2);
    });

    test('TC-SL02: Should apply subcategory filters correctly', async () => {
      req.query = { subcategory: 'Furniture' };
      mockForsaleFind.mockResolvedValue([]);
      mockForsaleCountDocuments.mockResolvedValue(0);

      await forsaleController.getAllForSale(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
    });

    test('TC-SL03: Should return 500 on database error', async () => {
      mockForsaleFind.mockRejectedValue(new Error('Database error'));
      await forsaleController.getAllForSale(req, res);

      expect(res.statusCode).toBe(500);
      expect(res._json.success).toBe(false);
    });
  });

  describe('2. getListingById (Public)', () => {
    test('TC-SL04: Should return 404 for non-existent slug/invalid ID', async () => {
      req.params = { id: 'invalid-id' };

      const ForSale = require('../models/forsale.model');
      if (!ForSale.findOne) ForSale.findOne = jest.fn();
      ForSale.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(null),
      });

      await forsaleController.getForSaleById(req, res);

      expect(res.statusCode).toBe(404);
    });

    test('TC-SL05: Should return 404 if listing not found', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      const ForSale = require('../models/forsale.model');
      ForSale.findById.mockImplementationOnce(() => ({
        populate: jest.fn().mockResolvedValue(null),
      }));

      await forsaleController.getForSaleById(req, res);

      expect(res.statusCode).toBe(404);
      expect(res._json.success).toBe(false);
    });

    test('TC-SL06: Should return listing if valid ID provided', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      const mockListing = {
        _id: req.params.id, title: 'Valid Listing', images: ['img.jpg'],
        toObject: function() { return { ...this }; },
      };
      const ForSale = require('../models/forsale.model');
      ForSale.findById.mockImplementationOnce(() => ({
        populate: jest.fn().mockResolvedValue(mockListing),
      }));

      await forsaleController.getForSaleById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.listing.title).toBe('Valid Listing');
    });
  });

  describe('3. getMyListings (Protected)', () => {
    test('TC-SL07: Should return listings for the authenticated user', async () => {
      req.user = { _id: 'user-123' };
      const mockUserListings = [{ _id: '1', title: 'My Item', images: [] }];

      mockPaginatedFind.mockResolvedValue({
        items: mockUserListings,
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      });

      await forsaleController.getMyForSale(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.listings[0].title).toBe('My Item');
    });
  });

  describe('4. deleteListing (Protected)', () => {
    test('TC-SL08: Should return 404 if trying to delete nonexistent listing', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.user = { _id: 'user-123' };

      require('../models/forsale.model').findById.mockResolvedValueOnce(null);

      await forsaleController.deleteForSale(req, res);

      expect(res.statusCode).toBe(404);
    });

    test('TC-SL09: Should delete listing if user owns it', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.user = { _id: 'user-123' };

      const mockListing = { _id: req.params.id, seller: { toString: () => 'user-123' }, images: [] };
      require('../models/forsale.model').findById.mockResolvedValueOnce(mockListing);
      mockForsaleFindByIdAndDelete.mockResolvedValue(true);

      await forsaleController.deleteForSale(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(mockForsaleFindByIdAndDelete).toHaveBeenCalled();
    });

    test('TC-SL10: Should forbid deletion if user is not the owner', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.user = { _id: 'hacker-456' };

      const mockListing = { _id: req.params.id, seller: { toString: () => 'user-123' }, images: [] };
      require('../models/forsale.model').findById.mockResolvedValueOnce(mockListing);

      await forsaleController.deleteForSale(req, res);

      expect(res.statusCode).toBe(403);
      expect(res._json.success).toBe(false);
      expect(res._json.message).toMatch(/authorized/i);
    });
  });
});
