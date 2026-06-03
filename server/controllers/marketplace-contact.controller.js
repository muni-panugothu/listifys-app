/**
 * Marketplace Contact Controller
 *
 * Responsibilities:
 *   1. Alternate contact phone OTP verification (sellers who want a different contact number)
 *   2. Call-click event recording + analytics (buyers tapping "Call Seller")
 *
 * Business rules:
 *   - contactPhone === user.accountPhone  →  auto-verified, no OTP needed
 *   - contactPhone !== user.accountPhone  →  Twilio Verify OTP required before publish
 *   - Call click returns tel: URL so React Native can open the native dialer
 *
 * Security:
 *   - Contact OTP routes require JWT auth (sellers only)
 *   - Call click works for guests (optional auth) but flags isAuthenticated=false
 *   - Phone numbers are NEVER stored plaintext in analytics — SHA-256 hash only
 *   - Rate limiting is applied at the route layer
 */

const crypto = require("crypto");
const TwilioVerify = require("../services/twilio-verify.service");
const ContactVerification = require("../models/contact-verification.model");
const LeadAnalytics = require("../models/lead-analytics.model");
const User = require("../models/user.model");
const { logger } = require("../utils/logger");

// ── POST /api/marketplace/contact/send-otp ────────────────────────────────────
/**
 * Seller requests an OTP to verify an alternate contact number.
 *
 * Body: { phone: "+919876543210", channel?: "sms" | "whatsapp" }
 *
 * Response 200 { success, alreadyVerified?, message }
 */
exports.sendContactOtp = async (req, res) => {
  try {
    const userId = req.user._id;
    const { phone, channel = "sms" } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    if (!TwilioVerify.isValidE164(phone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be in E.164 format (e.g. +919876543210).",
      });
    }

    if (!["sms", "whatsapp"].includes(channel)) {
      return res.status(400).json({
        success: false,
        message: "Channel must be 'sms' or 'whatsapp'.",
      });
    }

    // Rule: if this IS the account phone → auto-verified, no OTP needed
    const user = await User.findById(userId).select("phone");
    if (user?.phone && user.phone === phone) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        isAccountPhone: true,
        message: "This is your registered account number. It is automatically verified.",
      });
    }

    // Already verified for this user?
    const existing = await ContactVerification.findOne({
      userId,
      phone,
      verified: true,
      revokedAt: null,
    });
    if (existing) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        isAccountPhone: false,
        message: "This number is already verified for your account.",
      });
    }

    // Send via Twilio Verify
    const result = await TwilioVerify.sendVerification(phone, channel);
    if (!result.success) {
      logger.error("sendContactOtp: Twilio Verify failed", {
        userId: String(userId),
        error: result.error,
        code: result.code,
      });
      return res.status(502).json({
        success: false,
        message: result.error || "Failed to send OTP. Please try again.",
      });
    }

    // Upsert a pending verification record (TTL will clean up if never verified)
    await ContactVerification.findOneAndUpdate(
      { userId, phone },
      {
        userId,
        phone,
        verified: false,
        verifiedAt: null,
        verifySid: result.sid || null,
        revokedAt: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    logger.info("Contact OTP sent", {
      userId: String(userId),
      phone: TwilioVerify.maskPhone(phone),
      channel,
    });

    const channelLabel = channel === "whatsapp" ? "WhatsApp" : "SMS";
    res.status(200).json({
      success: true,
      alreadyVerified: false,
      message: `OTP sent to ${TwilioVerify.maskPhone(phone)} via ${channelLabel}. Valid for 10 minutes.`,
      expiresIn: 600,
    });
  } catch (err) {
    logger.error("sendContactOtp error", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── POST /api/marketplace/contact/verify-otp ─────────────────────────────────
/**
 * Seller confirms the OTP — marks the alternate phone verified.
 *
 * Body: { phone: "+919876543210", otp: "123456" }
 *
 * Response 200 { success, phone, message }
 */
exports.verifyContactOtp = async (req, res) => {
  try {
    const userId = req.user._id;
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required.",
      });
    }

    if (!TwilioVerify.isValidE164(phone)) {
      return res.status(400).json({ success: false, message: "Invalid phone number format." });
    }

    if (!/^\d{4,10}$/.test(String(otp).trim())) {
      return res.status(400).json({ success: false, message: "OTP must be 4–10 digits." });
    }

    // Check via Twilio Verify API
    const result = await TwilioVerify.checkVerification(phone, String(otp).trim());

    if (!result.success || !result.valid) {
      logger.warn("Contact OTP invalid", {
        userId: String(userId),
        phone: TwilioVerify.maskPhone(phone),
        error: result.error,
      });
      return res.status(400).json({
        success: false,
        message: result.error || "Invalid or expired OTP.",
      });
    }

    // Mark verified
    await ContactVerification.findOneAndUpdate(
      { userId, phone },
      {
        verified: true,
        verifiedAt: new Date(),
        verifySid: result.sid || null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      { upsert: true, new: true },
    );

    logger.info("Contact number verified", {
      userId: String(userId),
      phone: TwilioVerify.maskPhone(phone),
    });

    res.status(200).json({
      success: true,
      phone,
      message: "Phone number verified successfully. You can now use it as your contact number.",
    });
  } catch (err) {
    logger.error("verifyContactOtp error", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── GET /api/marketplace/contact/status ──────────────────────────────────────
/**
 * Check whether an alternate phone is verified for the current seller.
 *
 * Query: ?phone=+919876543210
 *
 * Response 200 { success, verified, isAccountPhone, verifiedAt? }
 */
exports.getVerificationStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ success: false, message: "phone query parameter required." });
    }

    if (!TwilioVerify.isValidE164(phone)) {
      return res.status(400).json({ success: false, message: "Invalid phone format." });
    }

    // Account phone is always verified
    const user = await User.findById(userId).select("phone");
    if (user?.phone && user.phone === phone) {
      return res.status(200).json({
        success: true,
        verified: true,
        isAccountPhone: true,
        verifiedAt: null,
      });
    }

    const record = await ContactVerification.findOne({
      userId,
      phone,
      verified: true,
      revokedAt: null,
    });

    res.status(200).json({
      success: true,
      verified: !!record,
      isAccountPhone: false,
      verifiedAt: record?.verifiedAt || null,
    });
  } catch (err) {
    logger.error("getVerificationStatus error", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── POST /api/marketplace/call-click ─────────────────────────────────────────
/**
 * Records a "Call Seller" (or WhatsApp click) event and returns the tel: URL.
 * Works for both authenticated buyers and guests.
 *
 * Body: {
 *   listingId:    "ObjectId string",
 *   listingModel: "ForSale" | "Vehicle" | ...,
 *   sellerId:     "ObjectId string",
 *   contactPhone: "+919876543210",
 *   platform?:    "ios" | "android" | "web",
 *   eventType?:   "call_click" | "whatsapp_click",
 * }
 *
 * Response 200 { success, telUrl, whatsappUrl? }
 */
exports.recordCallClick = async (req, res) => {
  try {
    const {
      listingId,
      listingModel = "ForSale",
      sellerId,
      contactPhone,
      platform = "unknown",
      eventType = "call_click",
    } = req.body;

    // Validate required fields
    if (!listingId || !sellerId || !contactPhone) {
      return res.status(400).json({
        success: false,
        message: "listingId, sellerId, and contactPhone are required.",
      });
    }

    if (!TwilioVerify.isValidE164(contactPhone)) {
      return res.status(400).json({
        success: false,
        message: "contactPhone must be in E.164 format (e.g. +919876543210).",
      });
    }

    const validPlatforms = ["ios", "android", "web", "unknown"];
    const validEvents = ["call_click", "whatsapp_click", "chat_open"];

    // Build the tel: URL — React Native uses Linking.openURL(telUrl)
    const telUrl = `tel:${contactPhone}`;
    const whatsappUrl = `https://wa.me/${contactPhone.replace("+", "")}`;

    // Save analytics non-blocking (never fail the user-facing response)
    setImmediate(async () => {
      try {
        await LeadAnalytics.create({
          listingId,
          listingModel: validPlatforms.includes(listingModel) ? listingModel : "ForSale",
          sellerId,
          buyerId: req.user?._id || null,
          contactPhoneHash: LeadAnalytics.hashPhone(contactPhone),
          eventType: validEvents.includes(eventType) ? eventType : "call_click",
          isAuthenticated: !!req.user,
          device: {
            platform: validPlatforms.includes(platform) ? platform : "unknown",
            // Zero last octet of IPv4 for privacy: "203.0.113.42" → "203.0.113.0"
            ipAddress: req.ip
              ? req.ip.replace(/\.\d+$/, ".0")
              : null,
            userAgent: req.get("user-agent") || null,
            country: null, // Set by geo-IP middleware if available
          },
        });
      } catch (analyticsErr) {
        logger.error("LeadAnalytics.create failed (non-blocking)", {
          listingId,
          error: analyticsErr.message,
        });
      }
    });

    const response = { success: true, telUrl };
    if (eventType === "whatsapp_click") {
      response.whatsappUrl = whatsappUrl;
    }

    res.status(200).json(response);
  } catch (err) {
    logger.error("recordCallClick error", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ── GET /api/marketplace/call-stats/:listingId ────────────────────────────────
/**
 * Seller dashboard: call statistics for a specific listing.
 *
 * Response 200 { success, total, last7d, last30d }
 */
exports.getCallStats = async (req, res) => {
  try {
    const { listingId } = req.params;
    const now = Date.now();

    const [total, last7d, last30d] = await Promise.all([
      LeadAnalytics.countDocuments({ listingId, eventType: "call_click" }),
      LeadAnalytics.countDocuments({
        listingId,
        eventType: "call_click",
        createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
      }),
      LeadAnalytics.countDocuments({
        listingId,
        eventType: "call_click",
        createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    res.status(200).json({ success: true, total, last7d, last30d });
  } catch (err) {
    logger.error("getCallStats error", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
