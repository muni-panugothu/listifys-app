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

jest.mock('../services/s3.service', () => ({
  toProxyUrl: jest.fn(url => url),
  deleteImage: jest.fn().mockResolvedValue(true),
  deleteImagesByUrls: jest.fn().mockResolvedValue(true),
}));

// Mock RabbitMQ producers
jest.mock('../queues/producers/listing.producer', () => ({
  publishListingCreated: jest.fn().mockResolvedValue(true),
  publishListingUpdated: jest.fn().mockResolvedValue(true),
  publishListingDeleted: jest.fn().mockResolvedValue(true),
  publishSearchIndex: jest.fn().mockResolvedValue(true),
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
const mockServiceListingFind = jest.fn();
const mockServiceListingCountDocuments = jest.fn();
const mockServiceListingFindById = jest.fn();
const mockServiceListingCreate = jest.fn();
const mockServiceListingFindByIdAndUpdate = jest.fn();
const mockServiceListingFindByIdAndDelete = jest.fn();

jest.mock('../models/servicelisting.model', () => ({
  find: jest.fn(() => ({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: mockServiceListingFind
  })),
  countDocuments: mockServiceListingCountDocuments,
  findById: jest.fn(() => ({
    populate: jest.fn().mockReturnThis(),
    lean: mockServiceListingFindById
  })),
  create: mockServiceListingCreate,
  findByIdAndUpdate: jest.fn(() => ({
    lean: mockServiceListingFindByIdAndUpdate
  })),
  findByIdAndDelete: mockServiceListingFindByIdAndDelete
}));

const mockServiceCategoryFindOne = jest.fn();
jest.mock('../models/servicecategory.model', () => ({
  findOne: mockServiceCategoryFindOne
}));

// Controller to Test
const serviceListingController = require('../controllers/servicelisting.controller');

// ─── TEST SUITE ─────────────────────────────────────────────────────────────
describe('🛠️ SERVICE LISTING CONTROLLER TESTS', () => {
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
      
      mockServiceListingFind.mockResolvedValue(mockListings);
      mockServiceListingCountDocuments.mockResolvedValue(2);

      await serviceListingController.getListings(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.data.length).toBe(2);
      expect(res._json.pagination.total).toBe(2);
    });

    test('TC-SL02: Should apply category filters correctly', async () => {
      req.query = { category: 'Plumbing Services' };
      mockServiceCategoryFindOne.mockResolvedValue({ _id: 'cat-id-123' });
      mockServiceListingFind.mockResolvedValue([]);
      mockServiceListingCountDocuments.mockResolvedValue(0);

      await serviceListingController.getListings(req, res);

      expect(mockServiceCategoryFindOne).toHaveBeenCalled();
      expect(res._json.success).toBe(true);
    });
    
    test('TC-SL03: Should return 500 on database error', async () => {
      mockServiceListingFind.mockRejectedValue(new Error('Database error'));
      await serviceListingController.getListings(req, res);
      
      expect(res.statusCode).toBe(500);
      expect(res._json.success).toBe(false);
    });
  });

  describe('2. getListingById (Public)', () => {
    test('TC-SL04: Should return 404 for non-existent slug/invalid ID', async () => {
      req.params = { id: 'invalid-id' };

      const ServiceListing = require('../models/servicelisting.model');
      if (!ServiceListing.findOne) ServiceListing.findOne = jest.fn();
      ServiceListing.findOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });

      await serviceListingController.getListingById(req, res);

      expect(res.statusCode).toBe(404);
    });

    test('TC-SL05: Should return 404 if listing not found', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      mockServiceListingFindById.mockResolvedValue(null);
      
      await serviceListingController.getListingById(req, res);
      
      expect(res.statusCode).toBe(404);
      expect(res._json.success).toBe(false);
    });

    test('TC-SL06: Should return listing if valid ID provided', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      const mockListing = { _id: req.params.id, title: 'Valid Listing', images: ['img.jpg'] };
      
      mockServiceListingFindById.mockResolvedValue(mockListing);
      
      await serviceListingController.getListingById(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.data.title).toBe('Valid Listing');
    });
  });

  describe('3. getMyListings (Protected)', () => {
    test('TC-SL07: Should return listings for the authenticated user', async () => {
      req.user = { _id: 'user-123' };
      const mockUserListings = [{ _id: '1', title: 'My Service' }];

      mockPaginatedFind.mockResolvedValue({
        items: mockUserListings,
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      });

      await serviceListingController.getMyListings(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.data[0].title).toBe('My Service');
    });
  });

  describe('4. deleteListing (Protected)', () => {
    test('TC-SL08: Should return 404 if trying to delete nonexistent listing', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.user = { _id: 'user-123' };
      
      require('../models/servicelisting.model').findById.mockResolvedValueOnce(null);
      
      await serviceListingController.deleteListing(req, res);
      
      expect(res.statusCode).toBe(404);
    });

    test('TC-SL09: Should delete listing if user owns it', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.user = { _id: 'user-123' };
      
      const mockListing = { _id: req.params.id, userId: { toString: () => 'user-123' }, images: [], toObject: () => ({ _id: req.params.id, images: [] }) };
      require('../models/servicelisting.model').findById.mockResolvedValueOnce(mockListing);
      
      mockServiceListingFindByIdAndDelete.mockResolvedValue(true);
      
      await serviceListingController.deleteListing(req, res);
      
      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(mockServiceListingFindByIdAndDelete).toHaveBeenCalled();
    });

    test('TC-SL10: Should forbid deletion if user is not the owner', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.user = { _id: 'hacker-456' }; // Different user
      
      const mockListing = { _id: req.params.id, userId: { toString: () => 'user-123' }, images: [] };
      require('../models/servicelisting.model').findById.mockResolvedValueOnce(mockListing);
      
      await serviceListingController.deleteListing(req, res);
      
      expect(res.statusCode).toBe(403);
      expect(res._json.success).toBe(false);
      expect(res._json.message).toMatch(/Unauthorized/i);
    });
  });
});
