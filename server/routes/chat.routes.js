const express = require("express");
const multer  = require("multer");
const router  = express.Router();
const { protect } = require("../middleware/auth.middleware.js");
const { uploadLimiter, createRateLimiter } = require("../middleware/ratelimiter.middleware.js");
const ctrl = require("../controllers/chat.controller.js");

const CHAT_MIME_TYPES = [
  "image/jpeg","image/jpg","image/png","image/gif","image/webp","image/avif",
  "image/heic","image/heif",
  "video/mp4","video/quicktime","video/webm","video/3gpp","video/3gpp2",
  "audio/mpeg","audio/mp3","audio/wav","audio/ogg","audio/mp4",
  "audio/m4a","audio/x-m4a","audio/aac","audio/amr","audio/3gpp",
  "application/pdf","application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain","text/csv",
  "application/zip","application/x-zip-compressed",
];

const CHAT_MAGIC = {
  ffd8ff: true,       // JPEG
  '89504e47': true,   // PNG
  '47494638': true,   // GIF
  '52494646': true,   // RIFF (WEBP/WAV)
  '25504446': true,   // PDF
  '504b0304': true,   // ZIP / Office Open XML
  '504b0506': true,
  '504b0708': true,
  'd0cf11e0': true,   // legacy Office
  '377abcaf': true,   // 7z
  '4f676753': true,   // OGG
  '494433': true,     // MP3 ID3
  'fff': true,        // MP3 frame sync (prefix match below)
  '2321414d52': true, // #!AMR
};

/** Return true when the buffer header matches the declared MIME family. */
function bufferMatchesMime(buffer, mimeType) {
  if (!buffer || buffer.length < 4) return false;
  const mt = String(mimeType || '').toLowerCase();
  const hex = buffer.slice(0, Math.min(12, buffer.length)).toString('hex').toLowerCase();

  // MP4 / M4A / MOV / HEIC — ISO base media; 'ftyp' at bytes 4–7
  if (mt.startsWith('video/') || mt.startsWith('audio/') || mt.includes('heic') || mt.includes('heif')) {
    if (buffer.length >= 8 && buffer.slice(4, 8).toString() === 'ftyp') return true;
  }

  if (mt.startsWith('image/')) {
    if (hex.startsWith('ffd8ff')) return true;
    if (hex.startsWith('89504e47')) return true;
    if (hex.startsWith('47494638')) return true;
    if (hex.startsWith('52494646')) return true; // WEBP container
    if (buffer.length >= 8 && buffer.slice(4, 8).toString() === 'ftyp') return true; // HEIC
  }

  if (mt.startsWith('audio/')) {
    if (buffer.length >= 8 && buffer.slice(4, 8).toString() === 'ftyp') return true;
    if (hex.startsWith('4f676753')) return true; // OGG
    if (hex.startsWith('52494646')) return true; // WAV (RIFF)
    if (hex.startsWith('494433')) return true;   // MP3 ID3
    if (hex.startsWith('ff')) return true;       // MP3/AAC frame sync
    if (hex.startsWith('2321414d52')) return true; // AMR
  }

  if (mt.startsWith('video/')) {
    if (buffer.length >= 8 && buffer.slice(4, 8).toString() === 'ftyp') return true;
    if (hex.startsWith('1a45dfa3')) return true; // WEBM/MKV
  }

  for (const magic of Object.keys(CHAT_MAGIC)) {
    if (hex.startsWith(magic)) return true;
  }
  return false;
}

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const mt = String(file.mimetype || '').toLowerCase();
    CHAT_MIME_TYPES.includes(mt) ? cb(null, true) : cb(new Error(`Unsupported file type: ${mt || 'unknown'}`), false);
  },
});

const validateMagicBytes = (req, res, next) => {
  if (!req.file?.buffer?.length) {
    return res.status(400).json({ success: false, message: 'Empty file upload — please try again.' });
  }
  const isText = ['text/plain', 'text/csv'].includes(req.file.mimetype);
  if (isText) return next();
  if (bufferMatchesMime(req.file.buffer, req.file.mimetype)) return next();
  return res.status(400).json({
    success: false,
    message: `File content does not match declared type (${req.file.mimetype}).`,
  });
};

const handleChatUpload = (req, res, next) => {
  chatUpload.single('file')(req, res, (err) => {
    if (err) {
      const message = err.message || 'Upload rejected';
      const status  = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ success: false, message });
    }
    next();
  });
};

const msgLimiter = createRateLimiter({ windowMs: 60_000, max: 120, keyPrefix: 'chat:send' });

router.use(protect);

// ── Conversations ──────────────────────────────────────────────────────────────
router.post("/conversations",                          ctrl.getOrCreateConversation);
router.get("/conversations",                           ctrl.getConversations);
router.get("/conversations/:conversationId",           ctrl.getConversation);

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
  handleChatUpload,
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
