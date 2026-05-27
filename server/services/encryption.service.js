/**
 * ═══════════════════════════════════════════════════════════════════
 * AES-256-GCM Encryption Service
 * ═══════════════════════════════════════════════════════════════════
 *
 * Encrypts sensitive data (chat messages, notifications) before they
 * are stored in MongoDB. Decrypts when reading back for authorised users.
 *
 * Algorithm : AES-256-GCM  (authenticated encryption)
 * Key length: 256 bits (32 bytes) — from CHAT_ENCRYPTION_KEY env var
 * IV        : 12 bytes random per encryption (stored with ciphertext)
 * Auth tag  : 16 bytes (appended to ciphertext)
 *
 * Stored format (base64):  <iv:12>  <authTag:16>  <ciphertext:N>
 *                          all concatenated then base64-encoded
 *
 * Why AES-256-GCM?
 * - Industry standard (used by Signal, WhatsApp, TLS 1.3)
 * - Authenticated encryption: tamper-proof (any bit flip = decryption fails)
 * - Fast with hardware AES-NI support on modern CPUs
 * ═══════════════════════════════════════════════════════════════════
 */

const crypto = require("crypto");
const { logger } = require("../utils/logger");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const ENCODING = "base64";

// ── Derive the 256-bit key once at startup ──
let encryptionKey = null;
let missingKeyWarningShown = false;

function getKey() {
  if (encryptionKey) return encryptionKey;

  const envKey = process.env.CHAT_ENCRYPTION_KEY;
  if (!envKey) {
    if (!missingKeyWarningShown) {
      logger.warn(
        "⚠️  CHAT_ENCRYPTION_KEY not set — messages will be stored in PLAIN TEXT. " +
        "Generate one with:  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
      missingKeyWarningShown = true;
    }
    return null;
  }

  // Key may be hex (64 chars) or base64 (44 chars) — normalise to Buffer
  if (/^[0-9a-f]{64}$/i.test(envKey)) {
    encryptionKey = Buffer.from(envKey, "hex");
  } else {
    encryptionKey = Buffer.from(envKey, "base64");
  }

  if (encryptionKey.length !== 32) {
    logger.error(
      `❌ CHAT_ENCRYPTION_KEY must be exactly 32 bytes (256 bits). Got ${encryptionKey.length} bytes.`
    );
    encryptionKey = null;
    return null;
  }

  logger.info("🔐 Chat encryption key loaded (AES-256-GCM)");
  return encryptionKey;
}

// ═══════════════════════════════════════════════════════════════════
// ENCRYPT  —  plainText ➜ base64 ciphertext (iv + authTag + cipher)
// ═══════════════════════════════════════════════════════════════════
function encrypt(plainText) {
  const key = getKey();
  if (!key || !plainText) return plainText; // graceful fallback

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
      cipher.update(plainText, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Combine: iv (12) + authTag (16) + ciphertext (N)
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return `enc:${combined.toString(ENCODING)}`;
  } catch (error) {
    logger.error("Encryption failed:", error.message);
    return plainText; // fallback to plain on error
  }
}

// ═══════════════════════════════════════════════════════════════════
// DECRYPT  —  base64 ciphertext ➜ plainText
// ═══════════════════════════════════════════════════════════════════
function decrypt(cipherText) {
  const key = getKey();
  if (!key || !cipherText) return cipherText;

  // Only decrypt strings that were encrypted by us (prefixed with "enc:")
  if (typeof cipherText !== "string" || !cipherText.startsWith("enc:")) {
    return cipherText; // plain text — return as-is (backward compatible)
  }

  try {
    const combined = Buffer.from(cipherText.slice(4), ENCODING);

    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      logger.warn("Decryption skipped: ciphertext too short");
      return cipherText;
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    logger.error("Decryption failed:", error.message);
    return "[Encrypted message — unable to decrypt]";
  }
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Check if encryption is active */
function isEncryptionEnabled() {
  return getKey() !== null;
}

/** Generate a new 256-bit key (for setup) */
function generateKey() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash content for search indexing (one-way — can't decrypt)
 * Useful if you ever need to search encrypted messages by keyword
 */
function hmacHash(text) {
  const key = getKey();
  if (!key || !text) return null;
  return crypto
    .createHmac("sha256", key)
    .update(text.toLowerCase().trim())
    .digest("hex");
}

module.exports = {
  encrypt,
  decrypt,
  isEncryptionEnabled,
  generateKey,
  hmacHash,
};
