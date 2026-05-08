const mongoose = require('mongoose');
const { createMockReq, createMockRes } = require('./setup');

// ─── MOCK DEPENDENCIES ──────────────────────────────────────────────
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), securityLog: jest.fn() }
}));

jest.mock('../services/encryption.service', () => ({
  encrypt: jest.fn((msg) => msg),
  decrypt: jest.fn((msg) => msg),
  isEncryptionEnabled: jest.fn(() => false),
}));

jest.mock('../services/s3.service', () => ({
  toProxyUrl: jest.fn(url => url),
  deleteImage: jest.fn().mockResolvedValue(true),
  deleteImagesByUrls: jest.fn().mockResolvedValue(true),
}));

jest.mock('../config/socket', () => ({
  getIO: jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) })),
}));

jest.mock('../controllers/notification.controller', () => ({
  createNotification: jest.fn().mockResolvedValue(null),
}));

jest.mock('../queues/producers/notification.producer', () => ({
  publishChatNotification: jest.fn().mockResolvedValue(true),
  publishOfferEmail: jest.fn().mockResolvedValue(true),
  publishNotification: jest.fn().mockResolvedValue(true),
}));

// ─── Model Mocks ────────────────────────────────────────────────────
const mockConversationFind = jest.fn();
const mockConversationFindOne = jest.fn();
const mockConversationCountDocuments = jest.fn();
const mockConversationCreate = jest.fn();
const mockConversationFindById = jest.fn();
const mockConversationFindByIdAndUpdate = jest.fn();

jest.mock('../models/conversation.model', () => {
  const MockConversation = {
    find: jest.fn(() => ({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: mockConversationFind,
    })),
    findOne: mockConversationFindOne,
    countDocuments: mockConversationCountDocuments,
    create: mockConversationCreate,
    findById: jest.fn(() => ({
      populate: jest.fn().mockReturnThis(),
      lean: mockConversationFindById,
    })),
    findByIdAndUpdate: mockConversationFindByIdAndUpdate,
  };
  return MockConversation;
});

const mockMessageFind = jest.fn();
const mockMessageCountDocuments = jest.fn();
const mockMessageCreate = jest.fn();
const mockMessageFindById = jest.fn();
const mockMessageFindOneAndUpdate = jest.fn();

jest.mock('../models/message.model', () => ({
  find: jest.fn(() => ({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: mockMessageFind,
  })),
  countDocuments: mockMessageCountDocuments,
  create: mockMessageCreate,
  findById: jest.fn(() => ({
    populate: jest.fn().mockReturnThis(),
    lean: mockMessageFindById,
  })),
  findOneAndUpdate: mockMessageFindOneAndUpdate,
}));

const mockUserFindById = jest.fn();
jest.mock('../models/user.model', () => ({
  findById: mockUserFindById,
}));

const chatController = require('../controllers/chat.controller');

// ─── TEST SUITE ─────────────────────────────────────────────────────────────
describe('💬 CHAT CONTROLLER TESTS', () => {
  let req, res;
  const userId = new mongoose.Types.ObjectId().toString();
  const recipientId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    req = createMockReq({ user: { id: userId, _id: userId, name: 'Test User' } });
    res = createMockRes();
  });

  // ── 1. getOrCreateConversation ────────────────────────────────────
  describe('1. getOrCreateConversation', () => {
    test('TC-CH01: Should reject if recipientId is missing', async () => {
      req.body = {};
      await chatController.getOrCreateConversation(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._json.message).toMatch(/recipientId/i);
    });

    test('TC-CH02: Should reject messaging yourself', async () => {
      req.body = { recipientId: userId };
      await chatController.getOrCreateConversation(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._json.message).toMatch(/yourself/i);
    });

    test('TC-CH03: Should return 404 if recipient not found', async () => {
      req.body = { recipientId };
      mockUserFindById.mockResolvedValue(null);
      await chatController.getOrCreateConversation(req, res);
      expect(res.statusCode).toBe(404);
    });

    test('TC-CH04: Should return existing conversation', async () => {
      req.body = { recipientId };
      mockUserFindById.mockResolvedValue({ _id: recipientId, name: 'Recipient' });

      const Conversation = require('../models/conversation.model');
      const existingConv = {
        _id: 'conv-123',
        participants: [
          { _id: userId, name: 'Test User', profileImage: null, googleProfileImage: null, avatar: 'a.png', provider: 'local' },
          { _id: recipientId, name: 'Recipient', profileImage: null, googleProfileImage: null, avatar: 'b.png', provider: 'local' },
        ],
        listing: {},
        lastMessage: null,
        unreadCounts: new Map(),
        updatedAt: new Date(),
        createdAt: new Date(),
      };
      Conversation.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(existingConv),
        }),
      });

      await chatController.getOrCreateConversation(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.conversation).toBeDefined();
    });

    test('TC-CH04A: Should reject invalid recipientId format', async () => {
      req.body = { recipientId: 'not-an-objectid' };
      await chatController.getOrCreateConversation(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._json.message).toMatch(/invalid recipientid/i);
    });

    test('TC-CH04B: Should reject invalid listingId format', async () => {
      req.body = {
        recipientId,
        listingId: 'bad-listing-id',
        listingType: 'electronics',
      };
      await chatController.getOrCreateConversation(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._json.message).toMatch(/invalid listingid/i);
    });
  });

  // ── 2. getConversations ───────────────────────────────────────────
  describe('2. getConversations', () => {
    test('TC-CH05: Should return paginated conversations', async () => {
      req.query = { page: 1, limit: 10 };
      const mockConvs = [
        {
          _id: 'conv-1',
          participants: [
            { _id: userId, name: 'Me', profileImage: null, googleProfileImage: null, avatar: 'a.png', provider: 'local' },
          ],
          listing: {},
          lastMessage: { content: 'Hey', attachments: [], sender: userId, createdAt: new Date() },
          unreadCounts: {},
          updatedAt: new Date(),
          createdAt: new Date(),
        },
      ];

      mockConversationFind.mockResolvedValue(mockConvs);
      mockConversationCountDocuments.mockResolvedValue(1);

      await chatController.getConversations(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.conversations.length).toBe(1);
      expect(res._json.pagination).toBeDefined();
    });

    test('TC-CH06: Should set no-cache headers', async () => {
      mockConversationFind.mockResolvedValue([]);
      mockConversationCountDocuments.mockResolvedValue(0);

      await chatController.getConversations(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('no-store'));
    });

    test('TC-CH07: Should return 500 on error', async () => {
      mockConversationFind.mockRejectedValue(new Error('DB error'));
      await chatController.getConversations(req, res);
      expect(res.statusCode).toBe(500);
      expect(res._json.success).toBe(false);
    });
  });

  // ── 3. getMessages ────────────────────────────────────────────────
  describe('3. getMessages', () => {
    test('TC-CH08: Should return 404 if user not in conversation', async () => {
      req.params = { conversationId: new mongoose.Types.ObjectId().toString() };

      mockConversationFindOne.mockResolvedValueOnce(null);

      await chatController.getMessages(req, res);

      expect(res.statusCode).toBe(404);
    });

    test('TC-CH09: Should return paginated messages', async () => {
      const convId = new mongoose.Types.ObjectId().toString();
      req.params = { conversationId: convId };
      req.query = { page: 1, limit: 20 };

      mockConversationFindOne.mockResolvedValueOnce({ _id: convId, participants: [userId, recipientId] });

      const mockMsgs = [
        {
          _id: 'm1', content: 'Hello', sender: { _id: userId, name: 'Me' },
          attachments: [], createdAt: new Date(),
        },
      ];
      mockMessageFind.mockResolvedValue(mockMsgs);
      mockMessageCountDocuments.mockResolvedValue(1);

      await chatController.getMessages(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.messages.length).toBe(1);
    });
  });

  // ── 4. sendMessage ────────────────────────────────────────────────
  describe('4. sendMessage', () => {
    test('TC-CH10: Should reject empty message without attachments', async () => {
      req.params = { conversationId: new mongoose.Types.ObjectId().toString() };
      req.body = { content: '' };

      // sendMessage checks empty content BEFORE calling findOne, so no mock needed

      await chatController.sendMessage(req, res);

      expect(res.statusCode).toBe(400);
    });

    test('TC-CH11: Should return 404 if user not a participant', async () => {
      req.params = { conversationId: new mongoose.Types.ObjectId().toString() };
      req.body = { content: 'Hello' };

      mockConversationFindOne.mockResolvedValueOnce(null);

      await chatController.sendMessage(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ── 5. markAsRead ─────────────────────────────────────────────────
  describe('5. markAsRead', () => {
    test('TC-CH12: Should return 404 if conversation not found or not participant', async () => {
      req.params = { conversationId: new mongoose.Types.ObjectId().toString() };

      mockConversationFindOne.mockResolvedValueOnce(null);

      await chatController.markAsRead(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ── 6. getUnreadCount ─────────────────────────────────────────────
  describe('6. getUnreadCount', () => {
    test('TC-CH13: Should return total unread count across conversations', async () => {
      const Conversation = require('../models/conversation.model');
      // getUnreadCount uses Conversation.find({ participants }).lean()
      mockConversationFind.mockResolvedValue([
        { unreadCounts: { [userId]: 2 } },
        { unreadCounts: { [userId]: 3 } },
      ]);

      await chatController.getUnreadCount(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.unreadCount).toBe(5);
    });
  });
});
