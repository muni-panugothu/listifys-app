const express = require("express");
const multer  = require("multer");
const router  = express.Router();
const { protect } = require("../middleware/auth.middleware.js");
const { uploadLimiter, createRateLimiter } = require("../middleware/ratelimiter.middleware.js");
const ctrl = require("../controllers/chat.controller.js");

const CHAT_MIME_TYPES = [
  "image/jpeg","image/jpg","image/png","image/gif","image/webp","image/avif",
  "video/mp4","video/quicktime","video/webm",
  "audio/mpeg","audio/mp3","audio/wav","audio/ogg","audio/mp4",
  "application/pdf","application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain","text/csv",
  "application/zip","application/x-zip-compressed",
];
const CHAT_MAGIC = { 'ffd8ff':true,'89504e47':true,'47494638':true,'52494646':true,'25504446':true,'504b0304':true,'504b0506':true,'504b0708':true,'d0cf11e0':true,'377abcaf':true };

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    CHAT_MIME_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new Error("Unsupported type"), false);
  },
});

const validateMagicBytes = (req, res, next) => {
  if (!req.file?.buffer) return next();
  const isText = ['text/plain','text/csv'].includes(req.file.mimetype);
  if (isText) return next();
  const hex = req.file.buffer.slice(0, 8).toString('hex').toLowerCase();
  for (const magic of Object.keys(CHAT_MAGIC)) {
    if (hex.startsWith(magic)) return next();
  }
  return res.status(400).json({ success: false, message: 'File content does not match declared type.' });
};

const msgLimiter = createRateLimiter({ windowMs: 60_000, max: 120, keyPrefix: 'chat:send' });

router.use(protect);

// ── Conversations ──────────────────────────────────────────────────────────────
router.post("/conversations",                          ctrl.getOrCreateConversation);
router.get("/conversations",                           ctrl.getConversations);

// ── Product Threads ───────────────────────────────────────────────────────────
router.post("/conversations/:conversationId/threads",  ctrl.getOrCreateThread);
router.get("/conversations/:conversationId/threads",   ctrl.listThreads);
router.put("/threads/:threadId/close",                 ctrl.closeThread);

// ── Messages ──────────────────────────────────────────────────────────────────
router.get("/conversations/:conversationId/messages",  ctrl.getMessages);
router.post("/conversations/:conversationId/messages", msgLimiter, ctrl.sendMessage);
router.get("/threads/:threadId/messages",              ctrl.getThreadMessages);

// ── Attachments ───────────────────────────────────────────────────────────────
router.post(
  "/conversations/:conversationId/attachments",
  uploadLimiter,
  chatUpload.single("file"),
  validateMagicBytes,
  ctrl.uploadAttachment,
);

// ── Read receipts ─────────────────────────────────────────────────────────────
router.put("/conversations/:conversationId/read",      ctrl.markAsRead);
router.put("/threads/:threadId/read",                  ctrl.markThreadRead);

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete("/conversations/:conversationId/messages/:messageId",          ctrl.deleteMessageForMe);
router.delete("/conversations/:conversationId/messages/:messageId/everyone", ctrl.deleteMessageForEveryone);

// ── Search ────────────────────────────────────────────────────────────────────
router.get("/conversations/:conversationId/search",    ctrl.searchMessages);

// ── Offers ────────────────────────────────────────────────────────────────────
router.post("/threads/:threadId/offer",                ctrl.makeOffer);
router.put("/threads/:threadId/offer/accept",          ctrl.acceptOffer);
router.put("/threads/:threadId/offer/decline",         ctrl.declineOffer);

// ── Unread ────────────────────────────────────────────────────────────────────
router.get("/unread-count",                            ctrl.getUnreadCount);

// Legacy
router.post("/make-offer",                             ctrl.makeOfferLegacy);

module.exports = router;
