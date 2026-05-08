const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const twilio = require("twilio");
const { logger } = require("../utils/logger");

// ── Twilio client setup ─────────────────────────────────────────────
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const fromNumber = process.env.TWILIO_PHONE_NUMBER; // fallback if no messaging service

let client = null;

if (!accountSid || !authToken) {
  logger.warn(
    "Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN). Phone OTP will fail."
  );
} else {
  client = twilio(accountSid, authToken);
  logger.info("Twilio client configured", {
    accountSid: accountSid.slice(0, 8) + "...",
    messagingServiceSid: messagingServiceSid || "(not set — using TWILIO_PHONE_NUMBER)",
  });
}

/**
 * Normalise phone number to E.164 format.
 * Accepts "+919876543210", "919876543210", "9876543210" (assumes India +91).
 */
function normalizePhone(phone, defaultCountryCode = "+91") {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
  // If it looks like a 10-digit Indian number, prepend +91
  if (/^\d{10}$/.test(cleaned)) return defaultCountryCode + cleaned;
  // If it starts with country code digits (e.g. 91...) but no +
  if (cleaned.length > 10) return "+" + cleaned;
  return defaultCountryCode + cleaned;
}

/**
 * Send an SMS OTP to the given phone number.
 * @param {string} phone - Phone number (will be normalised to E.164)
 * @param {string} otp   - The 6-digit OTP code
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendOTP(phone, otp) {
  if (!client) {
    logger.error("Twilio client not initialised — cannot send SMS OTP");
    return { success: false, error: "SMS service not configured" };
  }

  const to = normalizePhone(phone);
  if (!to) {
    return { success: false, error: "Invalid phone number" };
  }

  try {
    const messageOptions = {
      body: `Your Listify verification code is: ${otp}. It expires in 5 minutes. Do not share this code.`,
      to,
    };

    // Prefer Messaging Service (handles sender pool, compliance, etc.)
    if (messagingServiceSid) {
      messageOptions.messagingServiceSid = messagingServiceSid;
    } else if (fromNumber) {
      messageOptions.from = fromNumber;
    } else {
      logger.error("No Twilio sender configured (TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER)");
      return { success: false, error: "SMS sender not configured" };
    }

    const message = await client.messages.create(messageOptions);

    logger.info("SMS OTP sent", {
      to: to.slice(0, 5) + "****",
      messageId: message.sid,
      status: message.status,
    });

    return { success: true, messageId: message.sid };
  } catch (error) {
    logger.error("Failed to send SMS OTP", {
      error: error.message,
      code: error.code,
      to: to.slice(0, 5) + "****",
    });
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendOTP,
  normalizePhone,
};
