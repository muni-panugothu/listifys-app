const { createMockReq, createMockRes } = require('./setup');

// ─── MOCK DEPENDENCIES ──────────────────────────────────────────────
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), securityLog: jest.fn() }
}));

const {
  validateRegister,
  validateLogin,
  validateListingInput,
  VALID_CATEGORY_SUBCATEGORY,
} = require('../middleware/validation.middleware');

describe('✅ VALIDATION MIDDLEWARE TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = createMockReq();
    res = createMockRes();
    next = jest.fn();
  });

  // ── 1. Registration Validation ────────────────────────────────────
  describe('1. validateRegister', () => {
    test('TC-VA01: Should reject empty body', async () => {
      req.body = {};
      await validateRegister(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('TC-VA02: Should reject invalid email', async () => {
      req.body = { name: 'Test User', email: 'not-an-email', password: 'SecureP@ss1!' };
      await validateRegister(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('TC-VA03: Should pass with valid registration data', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecureP@ss1!',
        confirmPassword: 'SecureP@ss1!',
      };
      await validateRegister(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('TC-VA04: Should reject blank name', async () => {
      req.body = { name: '   ', email: 'test@example.com', password: 'SecureP@ss1!' };
      await validateRegister(req, res, next);
      expect(res.statusCode).toBe(400);
    });
  });

  // ── 2. Login Validation ───────────────────────────────────────────
  describe('2. validateLogin', () => {
    test('TC-VA05: Should reject empty body', async () => {
      req.body = {};
      await validateLogin(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    test('TC-VA06: Should reject missing password', async () => {
      req.body = { email: 'test@example.com' };
      await validateLogin(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    test('TC-VA07: Should pass with valid login data', async () => {
      req.body = { email: 'test@example.com', password: 'any-password' };
      await validateLogin(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ── 3. Listing Input Validation ───────────────────────────────────
  describe('3. validateListingInput', () => {
    const validListing = {
      title: 'Samsung Galaxy S24 Ultra',
      description: 'Brand new Samsung Galaxy S24 Ultra, sealed box, full warranty included',
      price: 120000,
      category: 'Mobiles',
      subcategory: 'Mobile Phones',
      location: 'Mumbai, India',
      condition: 'New',
      images: ['https://cdn.example.com/img1.jpg'],
      brand: 'Samsung',
    };

    test('TC-VA08: Should pass with valid listing data', async () => {
      req.body = { ...validListing };
      req.baseUrl = '/api/mobiles';
      req.originalUrl = '/api/mobiles';
      validateListingInput(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('TC-VA09: Should reject listing without title', async () => {
      req.body = { ...validListing, title: '' };
      req.baseUrl = '/api/mobiles';
      req.originalUrl = '/api/mobiles';
      await validateListingInput(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    test('TC-VA10: Should reject short description', async () => {
      req.body = { ...validListing, description: 'Too short' };
      req.baseUrl = '/api/mobiles';
      req.originalUrl = '/api/mobiles';
      await validateListingInput(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    test('TC-VA11: Should reject negative price', async () => {
      req.body = { ...validListing, price: -100 };
      req.baseUrl = '/api/mobiles';
      req.originalUrl = '/api/mobiles';
      await validateListingInput(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    test('TC-VA12: Should reject invalid category', async () => {
      req.body = { ...validListing, category: 'InvalidCategory' };
      req.baseUrl = '/api/mobiles';
      req.originalUrl = '/api/mobiles';
      await validateListingInput(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    test('TC-VA13: Should reject mismatched category and route', async () => {
      req.body = { ...validListing, category: 'Vehicles', subcategory: 'Cars' };
      req.baseUrl = '/api/electronics';
      req.originalUrl = '/api/electronics';
      await validateListingInput(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    test('TC-VA14: Should reject listing without images', async () => {
      req.body = { ...validListing, images: [] };
      req.baseUrl = '/api/mobiles';
      req.originalUrl = '/api/mobiles';
      await validateListingInput(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    test('TC-VA15: Should reject too many images (>10)', async () => {
      req.body = {
        ...validListing,
        images: Array(11).fill('https://cdn.example.com/img.jpg'),
      };
      req.baseUrl = '/api/mobiles';
      req.originalUrl = '/api/mobiles';
      await validateListingInput(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    test('TC-VA16: Should reject invalid condition value', async () => {
      req.body = { ...validListing, condition: 'Broken' };
      req.baseUrl = '/api/mobiles';
      req.originalUrl = '/api/mobiles';
      await validateListingInput(req, res, next);
      expect(res.statusCode).toBe(400);
    });

    test('TC-VA17: Should sanitize HTML from title', async () => {
      req.body = { ...validListing, title: '<script>alert("xss")</script>Phone' };
      req.baseUrl = '/api/mobiles';
      req.originalUrl = '/api/mobiles';
      await validateListingInput(req, res, next);
      if (next.mock.calls.length > 0) {
        expect(req.body.title).not.toContain('<script>');
      }
    });

    test('TC-VA18: Should coerce price to number', async () => {
      req.body = { ...validListing, price: '5000' };
      req.baseUrl = '/api/mobiles';
      req.originalUrl = '/api/mobiles';
      await validateListingInput(req, res, next);
      if (next.mock.calls.length > 0) {
        expect(typeof req.body.price).toBe('number');
      }
    });

    test('TC-VA19: Should allow partial PUT listing updates without create-only fields', async () => {
      req.method = 'PUT';
      req.body = {
        title: 'Samsung Galaxy S24 Ultra',
        description: 'Updated Samsung Galaxy S24 Ultra description with enough detail to pass validation.',
        price: 110000,
        condition: 'Used',
        location: 'Mumbai, India',
      };
      req.baseUrl = '/api/electronics';
      req.originalUrl = '/api/electronics/6a017230b8e7ce753e2d575d';

      await validateListingInput(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });
  });

  // ── 4. Category/Subcategory map ───────────────────────────────────
  describe('4. Category/Subcategory mapping', () => {
    test('TC-VA20: Should have all expected categories', () => {
      const expectedCategories = [
        'Jobs', 'Electronics', 'Vehicles', 'Events', 'Mobiles',
        'Furniture', 'Toys', 'Fashion',
      ];
      expectedCategories.forEach(cat => {
        expect(VALID_CATEGORY_SUBCATEGORY).toHaveProperty(cat);
      });
    });

    test('TC-VA21: Each category should have at least one subcategory', () => {
      Object.entries(VALID_CATEGORY_SUBCATEGORY).forEach(([cat, subs]) => {
        expect(subs.length).toBeGreaterThan(0);
      });
    });
  });
});
