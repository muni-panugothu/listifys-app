/**
 * Marketplace Contact Routes
 *
 * Base path: /api/marketplace
 *
 * Contact verification (sellers — JWT required):
 *   POST  /contact/send-otp     Send Twilio Verify OTP to alternate number
 *   POST  /contact/verify-otp   Confirm OTP → mark number verified
 *   GET   /contact/status       Check if a given phone is verified
 *
 * Call analytics (optional auth — works for guests):
 *   POST  /call-click           Record event, return tel: URL
 *   GET   /call-stats/:listingId  Seller dashboard stats
 */

const express = require("express");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const {
  protect,
  optionalAuth,
} = require("../middleware/auth.middleware");
const controller = require("../controllers/marketplace-contact.controller");

const router = express.Router();

// ── Rate limiters ─────────────────────────────────────────────────────────────

// OTP: strict — 5 requests per 10 minutes, keyed by authenticated user OR IP
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 5,
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req),
  message: {
    success: false,
    message: "Too many OTP requests. Please wait 10 minutes before trying again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Call click: generous — 60 per minute per IP (anti-bot, not anti-user)
const callClickLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 60,
  message: { success: false, message: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Contact phone verification (sellers) ─────────────────────────────────────
router.post(
  "/contact/send-otp",
  protect,
  otpLimiter,
  controller.sendContactOtp,
);

router.post(
  "/contact/verify-otp",
  protect,
  otpLimiter,
  controller.verifyContactOtp,
);

router.get(
  "/contact/status",
  protect,
  controller.getVerificationStatus,
);

// ── Call click analytics (buyers — optional auth) ─────────────────────────────
router.post(
  "/call-click",
  optionalAuth,
  callClickLimiter,
  controller.recordCallClick,
);

router.get(
  "/call-stats/:listingId",
  protect,
  controller.getCallStats,
);

module.exports = router;
