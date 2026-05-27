const express = require("express");
const multer = require("multer");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware.js");
const { uploadLimiter, createRateLimiter } = require("../middleware/ratelimiter.middleware.js");
const {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  uploadAttachment,
  deleteMessageForMe,
  deleteMessageForEveryone,
  markAsRead,
  getUnreadCount,
  makeOffer,
} = require("../controllers/chat.controller.js");

const CHAT_ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/avif",
  "video/mp4", "video/quicktime", "video/webm",
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv",
  "application/zip", "application/x-zip-compressed", "application/x-7z-compressed",
];

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (CHAT_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Unsupported attachment type"), false);
  },
});

// Magic-byte validation for chat attachments (covers images + documents)
const CHAT_MAGIC_BYTES = {
  'ffd8ff':   true, // JPEG
  '89504e47': true, // PNG
  '47494638': true, // GIF
  '52494646': true, // RIFF (WebP)
  '25504446': true, // PDF (%PDF)
  '504b0304': true, // ZIP/DOCX/XLSX/PPTX (PK archive)
  '504b0506': true, // ZIP (empty archive)
  '504b0708': true, // ZIP (spanned)
  'd0cf11e0': true, // MS Office legacy (.doc/.xls/.ppt)
  '377abcaf': true, // 7z
};
const validateChatAttachment = (req, res, next) => {
  if (!req.file || !req.file.buffer) return next();
  const hex = req.file.buffer.slice(0, 8).toString('hex').toLowerCase();
  // Plain text/CSV have no magic bytes — verify they are valid UTF-8 text
  const isTextType = ['text/plain', 'text/csv'].includes(req.file.mimetype);
  if (isTextType) return next();
  for (const magic of Object.keys(CHAT_MAGIC_BYTES)) {
    if (hex.startsWith(magic)) return next();
  }
  return res.status(400).json({
    success: false,
    message: 'File content does not match its declared type. Upload rejected.',
  });
};

// All routes are protected
router.use(protect);

// Per-user chat send limiter (applies only to POST message sends)
const chatMessageLimiter = createRateLimiter({
  keyPrefix: "rl:chat_msg",
  windowSec: 60,
  maxHits: 120,
  message: "Too many messages. Please slow down.",
  keyFn: (req) => req.user?._id?.toString() || req.ip,
});

// Conversations
router.post("/conversations", getOrCreateConversation);
router.get("/conversations", getConversations);

// Messages within a conversation
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/conversations/:conversationId/messages", chatMessageLimiter, sendMessage);
router.post(
  "/conversations/:conversationId/attachments",
  uploadLimiter,
  chatUpload.single("file"),
  validateChatAttachment,
  uploadAttachment,
);
router.put("/conversations/:conversationId/read", markAsRead);

// Delete messages
router.delete("/conversations/:conversationId/messages/:messageId", deleteMessageForMe);
router.delete("/conversations/:conversationId/messages/:messageId/everyone", deleteMessageForEveryone);

// Make offer (chat message + email notification)
router.post("/make-offer", makeOffer);

// Unread count across all conversations
router.get("/unread-count", getUnreadCount);

module.exports = router;
