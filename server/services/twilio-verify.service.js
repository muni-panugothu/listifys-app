/**
 * Twilio Verify Service
 *
 * Uses the Twilio Verify v2 API for OTP send + check.
 * This replaces manual OTP generation + Redis storage for phone auth.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID         - Your Twilio Account SID
 *   TWILIO_AUTH_TOKEN          - Your Twilio Auth Token
 *   TWILIO_VERIFY_SERVICE_SID  - Verify Service SID (create at console.twilio.com/verify)
 *
 * Twilio Verify benefits over manual OTP + SMS:
 *   - Twilio stores and validates OTP server-side — no Redis needed for OTP
 *   - Built-in rate limiting (Twilio rejects excessive requests)
 *   - International delivery routing, carrier compliance
 *   - Fraud detection + blocked number lists
 *   - Supports sms, whatsapp, call, email channels
 *
 * Architecture:
 *   Send:   POST .../verifications          { to, channel }
 *   Check:  POST .../verificationChecks     { to, code }
 *   Result: check.status === "approved"  →  valid OTP
 */

const twilio = require("twilio");
const { logger } = require("../utils/logger");

let memoizedClient = null;
let memoizedClientKey = "";

function getBypassConfig() {
  const enabledRaw = String(process.env.TWILIO_VERIFY_BYPASS_ENABLED || "").trim().toLowerCase();
  const enabled = enabledRaw === "1" || enabledRaw === "true" || enabledRaw === "yes";
  const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const code = String(process.env.TWILIO_VERIFY_BYPASS_CODE || "123456").trim();
  const phones = String(process.env.TWILIO_VERIFY_BYPASS_PHONES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    enabled: enabled && !isProduction,
    requestedInProduction: enabled && isProduction,
    code,
    phones,
  };
}

function canBypassForPhone(phone) {
  const config = getBypassConfig();
  if (!config.enabled) {
    if (config.requestedInProduction) {
      logger.warn("TwilioVerify bypass requested in production. Ignoring for safety.");
    }
    return false;
  }

  if (!phone) return true;
  if (!config.phones.length) return true;
  return config.phones.includes(phone);
}

function getTwilioConfig() {
  const accountSid =
    process.env.TWILIO_ACCOUNT_SID ||
    process.env.TWILIO_SID ||
    "";
  const authToken =
    process.env.TWILIO_AUTH_TOKEN ||
    process.env.TWILIO_TOKEN ||
    "";
  const verifyServiceSid =
    process.env.TWILIO_VERIFY_SERVICE_SID ||
    process.env.TWILIO_SERVICE_SID ||
    "";

  return {
    accountSid: accountSid.trim(),
    authToken: authToken.trim(),
    verifyServiceSid: verifyServiceSid.trim(),
  };
}

function getTwilioClient() {
  const { accountSid, authToken, verifyServiceSid } = getTwilioConfig();
  const clientKey = `${accountSid}:${authToken}`;

  if (!accountSid || !authToken) {
    logger.warn(
      "TwilioVerify: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set — Verify calls will fail.",
    );
    return { client: null, verifyServiceSid };
  }

  if (!memoizedClient || memoizedClientKey !== clientKey) {
    memoizedClient = twilio(accountSid, authToken);
    memoizedClientKey = clientKey;
    logger.info("TwilioVerify: Twilio client ready", {
      accountSid: accountSid.slice(0, 8) + "...",
      hasVerifyServiceSid: !!verifyServiceSid,
    });
  }

  if (!verifyServiceSid) {
    logger.warn(
      "TwilioVerify: TWILIO_VERIFY_SERVICE_SID not set — create a Verify Service at console.twilio.com/verify",
    );
  }

  return { client: memoizedClient, verifyServiceSid };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Build an E.164 phone number from separate parts.
 * @param {string} phoneCode     - Calling code prefix, e.g. "+91" or "91"
 * @param {string} nationalNumber - Subscriber digits, e.g. "9876543210"
 * @returns {string|null}
 */
function toE164(phoneCode, nationalNumber) {
  if (!phoneCode || !nationalNumber) return null;
  const stripped = nationalNumber.replace(/\D/g, "");
  const code = phoneCode.startsWith("+") ? phoneCode : `+${phoneCode}`;
  return `${code}${stripped}`;
}

/**
 * Validate that a string is a well-formed E.164 number.
 * Accepts 7–15 digits after the leading "+".
 * @param {string} phone
 * @returns {boolean}
 */
function isValidE164(phone) {
  return typeof phone === "string" && /^\+[1-9]\d{6,14}$/.test(phone.trim());
}

/**
 * Mask a phone number for safe logging: "+919876543210" → "+91987****210"
 */
function maskPhone(phone) {
  if (!phone || phone.length <= 7) return "****";
  return phone.slice(0, 5) + "****" + phone.slice(-3);
}

/**
 * Convert a Twilio error code to a user-friendly message.
 */
function mapTwilioError(code) {
  const errors = {
    20003: "Authentication failed. Contact support.",
    20404: "Verify Service not found. Check TWILIO_VERIFY_SERVICE_SID.",
    21408: "SMS permission for this destination is disabled in Twilio. Enable the destination country or use a supported number.",
    21608: "Twilio trial restriction: destination phone is not verified. Verify this number in Twilio console or upgrade the Twilio account.",
    60200: "Invalid phone number.",
    60202: "Max send attempts reached for this number today. Try again tomorrow.",
    60203: "Max OTP check attempts reached. Request a new OTP.",
    60212: "Too many OTP requests. Please wait before trying again.",
    60237: "This destination phone/carrier is not supported for Verify in your current Twilio configuration.",
    60410: "Invalid parameter. Check the phone number format.",
  };
  if (errors[code]) return errors[code];
  if (typeof code === "number") {
    return `Verification service error (Twilio code ${code}). Please try again.`;
  }
  return "Verification service error. Please try again.";
}

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Send a verification OTP via Twilio Verify.
 *
 * @param {string} to       - E.164 phone number, e.g. "+919876543210"
 * @param {string} channel  - "sms" | "whatsapp" | "call"  (default: "sms")
 * @returns {Promise<{ success: boolean, sid?: string, status?: string, error?: string, code?: number }>}
 */
async function sendVerification(to, channel = "sms") {
  const { client, verifyServiceSid } = getTwilioClient();
  if (!client || !verifyServiceSid) {
    logger.error("TwilioVerify.sendVerification: service not configured");
    return {
      success: false,
      error: "Verify service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.",
    };
  }

  const normalized = to?.trim();
  if (!isValidE164(normalized)) {
    return { success: false, error: "Invalid E.164 phone number." };
  }

  if (canBypassForPhone(normalized)) {
    logger.warn("TwilioVerify bypass active for sendVerification", {
      to: maskPhone(normalized),
    });
    return {
      success: true,
      sid: `bypass-${Date.now()}`,
      status: "pending",
      bypass: true,
    };
  }

  const safeChannel = ["sms", "whatsapp", "call"].includes(channel) ? channel : "sms";

  try {
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({ to: normalized, channel: safeChannel });

    logger.info("TwilioVerify: OTP sent", {
      to: maskPhone(normalized),
      channel: safeChannel,
      sid: verification.sid,
      status: verification.status,
    });

    return { success: true, sid: verification.sid, status: verification.status };
  } catch (err) {
    logger.error("TwilioVerify: sendVerification failed", {
      code: err.code,
      message: err.message,
      to: maskPhone(normalized),
    });
    return {
      success: false,
      error: mapTwilioError(err.code),
      code: err.code,
    };
  }
}

/**
 * Check a verification OTP via Twilio Verify.
 *
 * @param {string} to   - E.164 phone number (must match the one used in sendVerification)
 * @param {string} code - The OTP code entered by the user
 * @returns {Promise<{ success: boolean, valid: boolean, status?: string, error?: string }>}
 */
async function checkVerification(to, code) {
  const { client, verifyServiceSid } = getTwilioClient();
  if (!client || !verifyServiceSid) {
    logger.error("TwilioVerify.checkVerification: service not configured");
    return {
      success: false,
      valid: false,
      error: "Verify service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.",
    };
  }

  const normalized = to?.trim();
  if (!isValidE164(normalized)) {
    return { success: false, valid: false, error: "Invalid E.164 phone number." };
  }

  if (!code || !/^\d{4,10}$/.test(String(code).trim())) {
    return { success: false, valid: false, error: "OTP must be 4–10 digits." };
  }

  if (canBypassForPhone(normalized)) {
    const expectedCode = getBypassConfig().code;
    const enteredCode = String(code).trim();
    const valid = enteredCode === expectedCode;

    logger.warn("TwilioVerify bypass active for checkVerification", {
      to: maskPhone(normalized),
      valid,
    });

    return {
      success: true,
      valid,
      status: valid ? "approved" : "pending",
      ...(valid ? {} : { error: "Invalid OTP. Please try again." }),
      bypass: true,
    };
  }

  try {
    const check = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to: normalized, code: String(code).trim() });

    const valid = check.status === "approved";

    logger.info("TwilioVerify: OTP checked", {
      to: maskPhone(normalized),
      status: check.status,
      valid,
    });

    return { success: true, valid, status: check.status };
  } catch (err) {
    logger.error("TwilioVerify: checkVerification failed", {
      code: err.code,
      message: err.message,
      to: maskPhone(normalized),
    });

    // Twilio 404 = no pending verification found (expired or wrong number)
    if (err.status === 404) {
      return {
        success: false,
        valid: false,
        error: "OTP expired or not found. Please request a new one.",
      };
    }
    return {
      success: false,
      valid: false,
      error: mapTwilioError(err.code),
      code: err.code,
    };
  }
}

module.exports = {
  sendVerification,
  checkVerification,
  toE164,
  isValidE164,
  maskPhone,
};
