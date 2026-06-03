const mongoose = require('mongoose');
const { createMockReq, createMockRes } = require('./setup');

jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), productLog: jest.fn(), securityLog: jest.fn() } }));
jest.mock('../config/redis', () => ({ get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK'), setex: jest.fn().mockResolvedValue('OK'), del: jest.fn().mockResolvedValue(0), _stub: true }));
jest.mock('../services/listingcache.service', () => ({ getCachedListingList: jest.fn().mockResolvedValue(null), getCachedListing: jest.fn().mockResolvedValue(null), cacheListingList: jest.fn().mockResolvedValue(undefined), cacheListing: jest.fn().mockResolvedValue(undefined), prefetchCategoryListings: jest.fn().mockResolvedValue(undefined), cacheSearchResults: jest.fn().mockResolvedValue(undefined), invalidateListCaches: jest.fn().mockResolvedValue(undefined), invalidateListingCache: jest.fn().mockResolvedValue(undefined), logProductSaved: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/s3.service', () => ({ toProxyUrl: jest.fn(url => url), deleteImage: jest.fn().mockResolvedValue(true), deleteImagesByUrls: jest.fn().mockResolvedValue(true) }));
jest.mock('../services/viewcount.service', () => ({ recordView: jest.fn().mockResolvedValue(true) }));
jest.mock('../services/search.service', () => ({ indexListing: jest.fn().mockResolvedValue(true), deleteListing: jest.fn().mockResolvedValue(true) }));
jest.mock('../services/notifyfollowers.service', () => ({ notifyFollowersOfNewListing: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/geoQuery', () => ({ applyGeoFilter: jest.fn(), applyCountryFilter: jest.fn(), buildLocationRegex: jest.fn(() => ({ $regex: 'mock', $options: 'i' })), buildSortOption: jest.fn(() => ({ createdAt: -1 })) }));
jest.mock('../queues/producers/listing.producer', () => ({ publishListingCreated: jest.fn().mockResolvedValue(true), publishListingUpdated: jest.fn().mockResolvedValue(true), publishListingDeleted: jest.fn().mockResolvedValue(true), publishImageCleanup: jest.fn().mockResolvedValue(true) }));

const mockPaginatedFind = jest.fn();
jest.mock('../utils/pagination', () => ({ parsePagination: jest.fn((q, d) => { const limit = Number(q?.limit) || d?.limit || 20; const page = Number(q?.page) || 1; return { page, limit, skip: (page - 1) * limit }; }), paginatedFind: mockPaginatedFind }));

const mockFind = jest.fn();
const mockCountDocuments = jest.fn();
const mockFindByIdResult = jest.fn();
const mockFindOneResult = jest.fn();

jest.mock('../models/furniture.model', () => ({
  find: jest.fn(() => ({ select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), lean: mockFind })),
  countDocuments: mockCountDocuments,
  findById: jest.fn(() => ({ populate: jest.fn().mockResolvedValue(mockFindByIdResult()) })),
  findOne: jest.fn(() => ({ populate: jest.fn().mockResolvedValue(mockFindOneResult()) })),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(() => ({ lean: jest.fn() })),
}));

const controller = require('../controllers/furniture.controller');

describe('🪑 FURNITURE CONTROLLER TESTS', () => {
  let req, res;
  beforeEach(() => { jest.clearAllMocks(); req = createMockReq(); res = createMockRes(); });

  describe('1. getAllFurniture (Public)', () => {
    test('Should fetch paginated listings', async () => {
      req.query = { page: 1, limit: 10 };
      mockFind.mockResolvedValue([{ _id: '1', title: 'Office Desk', images: ['i.jpg'] }, { _id: '2', title: 'Sofa Set', images: ['i2.jpg'] }]);
      mockCountDocuments.mockResolvedValue(2);
      await controller.getAllFurniture(req, res);
      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.listings.length).toBe(2);
      expect(res._json.pagination.total).toBe(2);
    });
    test('Should handle empty results', async () => {
      mockFind.mockResolvedValue([]); mockCountDocuments.mockResolvedValue(0);
      await controller.getAllFurniture(req, res);
      expect(res.statusCode).toBe(200); expect(res._json.listings).toEqual([]);
    });
    test('Should return 500 on db error', async () => {
      mockFind.mockRejectedValue(new Error('DB error'));
      await controller.getAllFurniture(req, res);
      expect(res.statusCode).toBe(500); expect(res._json.success).toBe(false);
    });
  });

  describe('2. getFurnitureById (Public)', () => {
    test('Should return 404 for non-existent slug', async () => {
      req.params = { id: 'nonexistent-slug' }; mockFindOneResult.mockReturnValue(null);
      await controller.getFurnitureById(req, res);
      expect(res.statusCode).toBe(404);
    });
    test('Should return 404 if not found by ObjectId', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() }; mockFindByIdResult.mockReturnValue(null);
      await controller.getFurnitureById(req, res);
      expect(res.statusCode).toBe(404);
    });
    test('Should return listing if valid ID', async () => {
      const id = new mongoose.Types.ObjectId().toString(); req.params = { id };
      mockFindByIdResult.mockReturnValue({ _id: id, title: 'Office Desk', images: ['i.jpg'], status: 'active', toObject() { return { ...this }; } });
      await controller.getFurnitureById(req, res);
      expect(res.statusCode).toBe(200); expect(res._json.listing.title).toBe('Office Desk');
    });
  });

  describe('3. getMyFurniture (Protected)', () => {
    test('Should return user listings', async () => {
      req.user = { _id: 'user-123' };
      mockPaginatedFind.mockResolvedValue({ items: [{ _id: '1', title: 'My Item', images: [] }], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
      await controller.getMyFurniture(req, res);
      expect(res.statusCode).toBe(200); expect(res._json.success).toBe(true);
    });
  });

  describe('4. deleteFurniture (Protected)', () => {
    test('Should return 400 for invalid ObjectId', async () => {
      req.params = { id: 'not-valid' }; req.user = { _id: 'user-123' };
      await controller.deleteFurniture(req, res);
      expect(res.statusCode).toBe(400);
    });
    test('Should return 404 if not found', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() }; req.user = { _id: 'user-123' };
      require('../models/furniture.model').findById.mockResolvedValueOnce(null);
      await controller.deleteFurniture(req, res);
      expect(res.statusCode).toBe(404);
    });
    test('Should delete if owner', async () => {
      const id = new mongoose.Types.ObjectId().toString(); req.params = { id }; req.user = { _id: 'user-123' };
      const listing = { _id: id, seller: { toString: () => 'user-123' }, images: [], toObject() { return { ...this }; }, deleteOne: jest.fn().mockResolvedValue(true) };
      require('../models/furniture.model').findById.mockResolvedValueOnce(listing);
      await controller.deleteFurniture(req, res);
      expect(res.statusCode).toBe(200); expect(listing.deleteOne).toHaveBeenCalled();
    });
    test('Should forbid if not owner', async () => {
      const id = new mongoose.Types.ObjectId().toString(); req.params = { id }; req.user = { _id: 'attacker' };
      require('../models/furniture.model').findById.mockResolvedValueOnce({ _id: id, seller: { toString: () => 'user-123' }, images: [], toObject() { return { ...this }; }, deleteOne: jest.fn() });
      await controller.deleteFurniture(req, res);
      expect(res.statusCode).toBe(403); expect(res._json.message).toMatch(/authorized/i);
    });
  });
});
