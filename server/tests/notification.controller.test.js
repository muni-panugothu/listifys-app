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

// Mock Notification Model
const mockNotificationFind = jest.fn();
const mockNotificationCountDocuments = jest.fn();
const mockNotificationCreate = jest.fn();
const mockNotificationFindOneAndUpdate = jest.fn();
const mockNotificationFindOneAndDelete = jest.fn();
const mockNotificationUpdateMany = jest.fn();
const mockNotificationDeleteMany = jest.fn();

jest.mock('../models/notification.model', () => {
  const MockNotification = {
    find: jest.fn(() => ({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: mockNotificationFind,
    })),
    countDocuments: mockNotificationCountDocuments,
    create: mockNotificationCreate,
    findOneAndUpdate: mockNotificationFindOneAndUpdate,
    findOneAndDelete: mockNotificationFindOneAndDelete,
    updateMany: mockNotificationUpdateMany,
    deleteMany: mockNotificationDeleteMany,
  };
  return MockNotification;
});

const controller = require('../controllers/notification.controller');

// ─── TEST SUITE ─────────────────────────────────────────────────────────────
describe('🔔 NOTIFICATION CONTROLLER TESTS', () => {
  let req, res;
  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    req = createMockReq({ user: { id: userId, _id: userId } });
    res = createMockRes();
  });

  // ── 1. getNotifications ───────────────────────────────────────────
  describe('1. getNotifications', () => {
    test('TC-NO01: Should return paginated notifications', async () => {
      req.query = { page: 1, limit: 10 };
      const senderId = new mongoose.Types.ObjectId();
      const mockNotifs = [
        {
          _id: 'n1', type: 'message', message: 'Hello', read: false,
          sender: { _id: senderId, name: 'Sender', profileImage: null, googleProfileImage: null, avatar: 'av.png', provider: 'local' },
        },
      ];

      mockNotificationFind.mockResolvedValue(mockNotifs);
      mockNotificationCountDocuments
        .mockResolvedValueOnce(1)   // total
        .mockResolvedValueOnce(1);  // unreadCount

      await controller.getNotifications(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.notifications.length).toBe(1);
      expect(res._json.unreadCount).toBe(1);
      expect(res._json.pagination.total).toBe(1);
    });

    test('TC-NO02: Should return empty array when no notifications', async () => {
      req.query = {};
      mockNotificationFind.mockResolvedValue([]);
      mockNotificationCountDocuments
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await controller.getNotifications(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.notifications).toEqual([]);
      expect(res._json.unreadCount).toBe(0);
    });

    test('TC-NO03: Should set no-cache headers', async () => {
      mockNotificationFind.mockResolvedValue([]);
      mockNotificationCountDocuments
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await controller.getNotifications(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('no-store'));
    });

    test('TC-NO04: Should return 500 on database error', async () => {
      mockNotificationFind.mockRejectedValue(new Error('DB failure'));
      await controller.getNotifications(req, res);
      expect(res.statusCode).toBe(500);
      expect(res._json.success).toBe(false);
    });
  });

  // ── 2. getUnreadCount ─────────────────────────────────────────────
  describe('2. getUnreadCount', () => {
    test('TC-NO05: Should return unread count', async () => {
      mockNotificationCountDocuments.mockResolvedValue(5);
      await controller.getUnreadCount(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.unreadCount).toBe(5);
    });

    test('TC-NO06: Should return 0 when no unread', async () => {
      mockNotificationCountDocuments.mockResolvedValue(0);
      await controller.getUnreadCount(req, res);
      expect(res._json.unreadCount).toBe(0);
    });
  });

  // ── 3. markAsRead ─────────────────────────────────────────────────
  describe('3. markAsRead', () => {
    test('TC-NO07: Should mark notification as read', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      const mockNotif = { _id: req.params.id, read: true };
      mockNotificationFindOneAndUpdate.mockResolvedValue(mockNotif);

      await controller.markAsRead(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.notification.read).toBe(true);
    });

    test('TC-NO08: Should return 404 if notification not found', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      mockNotificationFindOneAndUpdate.mockResolvedValue(null);

      await controller.markAsRead(req, res);

      expect(res.statusCode).toBe(404);
      expect(res._json.success).toBe(false);
    });
  });

  // ── 4. markAllAsRead ──────────────────────────────────────────────
  describe('4. markAllAsRead', () => {
    test('TC-NO09: Should mark all notifications as read', async () => {
      mockNotificationUpdateMany.mockResolvedValue({ modifiedCount: 3 });

      await controller.markAllAsRead(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
    });
  });

  // ── 5. deleteNotification ─────────────────────────────────────────
  describe('5. deleteNotification', () => {
    test('TC-NO10: Should delete notification successfully', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      mockNotificationFindOneAndDelete.mockResolvedValue({ _id: req.params.id });

      await controller.deleteNotification(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.message).toMatch(/deleted/i);
    });

    test('TC-NO11: Should return 404 if notification not found', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      mockNotificationFindOneAndDelete.mockResolvedValue(null);

      await controller.deleteNotification(req, res);

      expect(res.statusCode).toBe(404);
      expect(res._json.success).toBe(false);
    });

    test('TC-NO12: Should only delete notifications owned by the user (recipient filter)', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      await controller.deleteNotification(req, res);

      const Notification = require('../models/notification.model');
      expect(Notification.findOneAndDelete).toHaveBeenCalledWith({
        _id: req.params.id,
        recipient: userId,
      });
    });
  });

  // ── 6. deleteAllNotifications ─────────────────────────────────────
  describe('6. deleteAllNotifications', () => {
    test('TC-NO13: Should delete all user notifications', async () => {
      mockNotificationDeleteMany.mockResolvedValue({ deletedCount: 5 });

      await controller.deleteAllNotifications(req, res);

      expect(res.statusCode).toBe(200);
      expect(res._json.success).toBe(true);
      expect(res._json.deletedCount).toBe(5);
    });
  });

  // ── 7. createNotification (internal) ──────────────────────────────
  describe('7. createNotification (internal)', () => {
    test('TC-NO14: Should create notification', async () => {
      const senderId = new mongoose.Types.ObjectId().toString();
      const recipientId = new mongoose.Types.ObjectId().toString();
      mockNotificationCreate.mockResolvedValue({
        _id: 'new-id', type: 'message', recipient: recipientId, sender: senderId,
      });

      const result = await controller.createNotification({
        recipient: recipientId,
        sender: senderId,
        type: 'message',
        message: 'Test message',
      });

      expect(result).toBeTruthy();
      expect(mockNotificationCreate).toHaveBeenCalled();
    });

    test('TC-NO15: Should not create self-notification', async () => {
      const sameId = new mongoose.Types.ObjectId().toString();
      const result = await controller.createNotification({
        recipient: sameId,
        sender: sameId,
        type: 'message',
        message: 'Self message',
      });

      expect(result).toBeNull();
      expect(mockNotificationCreate).not.toHaveBeenCalled();
    });

    test('TC-NO16: Should return null if recipient missing', async () => {
      const result = await controller.createNotification({
        recipient: null,
        sender: 'sender-id',
        type: 'message',
        message: 'No recipient',
      });
      expect(result).toBeNull();
    });
  });
});
