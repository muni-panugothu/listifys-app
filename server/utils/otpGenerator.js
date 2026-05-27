const crypto = require('crypto');

class OTPGenerator {
  /**
   * Generate cryptographically secure 6-digit OTP.
   * Uses crypto.randomInt() instead of Math.random() which is
   * predictable and NOT suitable for security-sensitive values.
   */
  static generateOTP() {
    // crypto.randomInt is CSPRNG-backed — safe for OTPs
    return crypto.randomInt(100000, 999999).toString();
  }

  // Generate alphanumeric OTP
  static generateAlphanumericOTP(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      otp += chars[randomIndex];
    }
    
    return otp;
  }

  // Generate secure token for email verification
  static generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash OTP before storing in Redis.
   * Even if Redis is breached, the attacker cannot recover the OTP.
   */
  static hashOTP(otp) {
    return crypto.createHash('sha256').update(String(otp)).digest('hex');
  }
}

module.exports = OTPGenerator;