const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware.js");
const notificationController = require("../controllers/notification.controller.js");

// All notification routes require authentication
router.use(protect);

// GET /api/notifications — list notifications (paginated)
router.get("/", notificationController.getNotifications);

// GET /api/notifications/unread-count — quick unread badge count
router.get("/unread-count", notificationController.getUnreadCount);

// PUT /api/notifications/read-all — mark all as read
router.put("/read-all", notificationController.markAllAsRead);

// PUT /api/notifications/:id/read — mark single as read
router.put("/:id/read", notificationController.markAsRead);

// POST /api/notifications/track — analytics event tracking
router.post("/track", notificationController.trackEvent);

// POST /api/notifications/fcm-token — register device FCM token for push
router.post("/fcm-token", notificationController.registerFcmToken);

// DELETE /api/notifications/all — delete all notifications
router.delete("/all", notificationController.deleteAllNotifications);

// DELETE /api/notifications/:id — delete single notification
router.delete("/:id", notificationController.deleteNotification);

module.exports = router;
