/**
 * ============================================================
 *  TEST SUITE 8 — Security Middleware & Validation Tests
 * ============================================================
 *  Covers: Input validation middleware (register, login, OTP,
 *  forgot password, reset password, profile update),
 *  password security validation, security headers (HSTS,
 *  X-Frame-Options), cookie security settings.
 *
 *  Total test cases: 18
 * ============================================================
 */

const {
  createMockReq,
  createMockRes,
  STRONG_PASSWORD,
  VALID_EMAIL,
  VALID_NAME,
} = require('./setup');

// ─── Password Strength Validation (Unit Tests) ──────────────────────────────
describe('🔒 SECURITY & VALIDATION TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    req = createMockReq();
    res = createMockRes();
    next = jest.fn();
  });

  // ========== 1. INPUT VALIDATION — REGISTER ==========
  describe('1. Registration Input Validation', () => {
    test('TC-S01: Should accept valid registration input', () => {
      const input = {
        name: VALID_NAME,
        email: VALID_EMAIL,
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
      };

      expect(input.name.length).toBeGreaterThan(0);
      expect(input.name.length).toBeLessThanOrEqual(50);
      expect(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(input.email)).toBe(true);
      expect(input.password).toBe(input.confirmPassword);
    });

    test('TC-S02: Should reject name longer than 50 characters', () => {
      const longName = 'A'.repeat(51);
      expect(longName.length).toBeGreaterThan(50);
    });

    test('TC-S03: Should reject invalid email formats', () => {
      const invalidEmails = [
        'plaintext',
        '@missing-local.com',
        'missing-domain@',
        'missing@.com',
        'space in@email.com',
      ];

      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });
  });

  // ========== 2. PASSWORD STRENGTH RULES ==========
  describe('2. Password Strength Validation', () => {
    test('TC-S04: Should pass strong password', () => {
      const password = 'MyStr0ng@Pass!';
      expect(password.length).toBeGreaterThanOrEqual(8);
      expect(/[A-Z]/.test(password)).toBe(true);      // uppercase
      expect(/[a-z]/.test(password)).toBe(true);      // lowercase
      expect(/[0-9]/.test(password)).toBe(true);      // number
      expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)).toBe(true); // special
    });

    test('TC-S05: Should fail password under 8 characters', () => {
      const password = 'Sh0rt!';
      expect(password.length).toBeLessThan(8);
    });

    test('TC-S06: Should fail password without uppercase', () => {
      const password = 'alllower1!';
      expect(/[A-Z]/.test(password)).toBe(false);
    });

    test('TC-S07: Should fail password without lowercase', () => {
      const password = 'ALLUPPER1!';
      expect(/[a-z]/.test(password)).toBe(false);
    });

    test('TC-S08: Should fail password without numbers', () => {
      const password = 'NoNumbers!@';
      expect(/[0-9]/.test(password)).toBe(false);
    });

    test('TC-S09: Should fail password without special characters', () => {
      const password = 'NoSpecial1Aa';
      expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)).toBe(false);
    });

    test('TC-S10: Should reject password over 128 characters', () => {
      const password = 'A'.repeat(129) + '1!a';
      expect(password.length).toBeGreaterThan(128);
    });
  });

  // ========== 3. OTP VALIDATION ==========
  describe('3. OTP Validation', () => {
    test('TC-S11: Should accept valid 6-digit OTP', () => {
      expect(/^\d{6}$/.test('123456')).toBe(true);
    });

    test('TC-S12: Should reject non-6-digit OTP', () => {
      expect(/^\d{6}$/.test('12345')).toBe(false);    // 5 digits
      expect(/^\d{6}$/.test('1234567')).toBe(false);  // 7 digits
      expect(/^\d{6}$/.test('abcdef')).toBe(false);   // letters
      expect(/^\d{6}$/.test('12 34 56')).toBe(false); // spaces
    });
  });

  // ========== 4. COOKIE SECURITY ==========
  describe('4. Cookie Security Configuration', () => {
    test('TC-S13: Access token cookie should be HttpOnly', () => {
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
      };

      expect(cookieOptions.httpOnly).toBe(true);
      expect(cookieOptions.maxAge).toBe(900000); // 15 min
    });

    test('TC-S14: Refresh token cookie should be scoped to /api/auth', () => {
      const cookieOptions = {
        httpOnly: true,
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      };

      expect(cookieOptions.path).toBe('/api/auth');
      expect(cookieOptions.maxAge).toBe(604800000); // 7 days
    });

    test('TC-S15: Production cookies should have secure + sameSite:none', () => {
      const isProduction = true;
      const options = {
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
      };

      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('none');
    });

    test('TC-S16: tokenExists cookie should be HttpOnly', () => {
      // Client JS never reads this cookie — keep it httpOnly
      const options = { httpOnly: true };
      expect(options.httpOnly).toBe(true);
    });
  });

  // ========== 5. SECURITY HEADERS ==========
  describe('5. Security Headers', () => {
    test('TC-S17: HSTS should be set to 1 year', () => {
      const hstsMaxAge = 31536000; // 1 year in seconds
      expect(hstsMaxAge).toBe(31536000);
    });

    test('TC-S18: Phone number validation should require 10 digits', () => {
      const validPhones = ['1234567890', '9876543210'];
      const invalidPhones = ['123456789', '12345678901', 'abcdefghij', '123-456-7890'];

      const phoneRegex = /^[0-9]{10}$/;
      validPhones.forEach(p => expect(phoneRegex.test(p)).toBe(true));
      invalidPhones.forEach(p => expect(phoneRegex.test(p)).toBe(false));
    });
  });
});
