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
const mockElectronicsFind = jest.fn();
const mockElectronicsCountDocuments = jest.fn();
const mockElectronicsFindByIdPopulate = jest.fn();
const mockElectronicsCreate = jest.fn();
const mockElectronicsFindByIdAndUpdate = jest.fn();
const mockElectronicsFindByIdAndDelete = jest.fn();

jest.mock('../models/electronics.model', () => {
  const findByIdMock = jest.fn();
  findByIdMock.mockImplementation(() => ({
    populate: jest.fn().mockReturnThis(),
    lean: mockElectronicsFindByIdPopulate,
  }));
  return {
    find: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: mockElectronicsFind,
    })),
    countDocuments: mockElectronicsCountDocuments,
    findById: findByIdMock,
    create: mockElectronicsCreate,
    findByIdAndUpdate: jest.fn(() => ({
      lean: mockElectronicsFindByIdAndUpdate,
    })),
    findByIdAndDelete: mockElectronicsFindByIdAndDelete,
    findOne: jest.fn(() => ({
      populate: jest.fn().mockResolvedValue(null),
    })),
  };
});

// Controller to Test
const electronicsController = require('../controllers/electronics.controller');

// ─── TEST SUITE ─────────────────────────────────────────────────────────────
describe('🛠️ ELECTRONICS CONTROLLER TESTS', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = createMockReq();
    res = createMockRes();
  });

  describe('1. getListings (Public)', () => {
    test('TC-SL01: Should fetch paginated service listings successfully', async () => {
      req.query = { page: 1, limit: 10 };

      const mockListings = [
        { _id: '1', title: 'Plumbing Repair', images: ['test.jpg'] },
        { _id: '2', title: 'Electrical Fix', images: ['test2.jpg'] }
      ];

      mockElectronicsFind.mockResolvedValue(mockListings);
      mockElectronicsCountDocuments.mockResolvedValue(2);

      await electronicsController.getAllElectronics(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.listings.length).toBe(2);
      expect(res._json.pagination.total).toBe(2);
    });

    test('TC-SL02: Should apply subcategory filters correctly', async () => {
      req.query = { subcategory: 'ACs' };
      mockElectronicsFind.mockResolvedValue([]);
      mockElectronicsCountDocuments.mockResolvedValue(0);

      await electronicsController.getAllElectronics(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
    });

    test('TC-SL03: Should return 500 on database error', async () => {
      mockElectronicsFind.mockRejectedValue(new Error('Database error'));
      await electronicsController.getAllElectronics(req, res);

      expect(res.statusCode).toBe(500);
      expect(res._json.success).toBe(false);
    });
  });

  describe('2. getListingById (Public)', () => {
    test('TC-SL04: Should return 404 for non-existent slug/invalid ID', async () => {
      req.params = { id: 'invalid-id' };

      const Electronics = require('../models/electronics.model');
      if (!Electronics.findOne) Electronics.findOne = jest.fn();
      Electronics.findOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(null),
      });

      await electronicsController.getElectronicsById(req, res);

      expect(res.statusCode).toBe(404);
    });

    test('TC-SL05: Should return 404 if listing not found', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      // findById returns object with .populate() for getById — controller then does .toObject() or uses result directly
      const Electronics = require('../models/electronics.model');
      Electronics.findById.mockImplementationOnce(() => ({
        populate: jest.fn().mockResolvedValue(null),
      }));

      await electronicsController.getElectronicsById(req, res);

      expect(res.statusCode).toBe(404);
      expect(res._json.success).toBe(false);
    });

    test('TC-SL06: Should return listing if valid ID provided', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      const mockListing = {
        _id: req.params.id, title: 'Valid Listing', images: ['img.jpg'],
        toObject: function() { return { ...this }; },
      };
      const Electronics = require('../models/electronics.model');
      Electronics.findById.mockImplementationOnce(() => ({
        populate: jest.fn().mockResolvedValue(mockListing),
      }));

      await electronicsController.getElectronicsById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.listing.title).toBe('Valid Listing');
    });
  });

  describe('3. getMyListings (Protected)', () => {
    test('TC-SL07: Should return listings for the authenticated user', async () => {
      req.user = { _id: 'user-123' };
      const mockUserListings = [{ _id: '1', title: 'My Service', images: [] }];

      mockPaginatedFind.mockResolvedValue({
        items: mockUserListings,
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      });

      await electronicsController.getMyElectronics(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.listings[0].title).toBe('My Service');
    });
  });

  describe('4. deleteListing (Protected)', () => {
    test('TC-SL08: Should return 404 if trying to delete nonexistent listing', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.user = { _id: 'user-123' };

      require('../models/electronics.model').findById.mockResolvedValueOnce(null);

      await electronicsController.deleteElectronics(req, res);

      expect(res.statusCode).toBe(404);
    });

    test('TC-SL09: Should delete listing if user owns it', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.user = { _id: 'user-123' };

      const mockListing = { _id: req.params.id, seller: { toString: () => 'user-123' }, images: [] };
      require('../models/electronics.model').findById.mockResolvedValueOnce(mockListing);
      mockElectronicsFindByIdAndDelete.mockResolvedValue(true);

      await electronicsController.deleteElectronics(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(mockElectronicsFindByIdAndDelete).toHaveBeenCalled();
    });

    test('TC-SL10: Should forbid deletion if user is not the owner', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.user = { _id: 'hacker-456' };

      const mockListing = { _id: req.params.id, seller: { toString: () => 'user-123' }, images: [] };
      require('../models/electronics.model').findById.mockResolvedValueOnce(mockListing);

      await electronicsController.deleteElectronics(req, res);

      expect(res.statusCode).toBe(403);
      expect(res._json.success).toBe(false);
      expect(res._json.message).toMatch(/authorized/i);
    });
  });
});
