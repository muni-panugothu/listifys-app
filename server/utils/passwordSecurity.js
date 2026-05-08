const crypto = require('crypto');
const argon2 = require('argon2');
const bcrypt = require('bcryptjs'); // backward compatibility for existing hashes
const User = require('../models/user.model.js');
const { logger } = require('./logger.js');

/**
 * Password strength requirements
 * - Minimum 8 characters
 * - Maximum 128 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 */
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  historyLimit: 5,
  expirationDays: 90 // optional - set to null to disable
};

/**
 * Check password strength against requirements
 * @param {string} password - Password to check
 * @returns {Object} Validation result
 */
const checkPasswordStrength = (password) => {
  const errors = [];
  
  if (!password) {
    return { isValid: false, errors: ['Password is required'], strength: 0 };
  }
  
  // Check length
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
  }
  
  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password cannot exceed ${PASSWORD_REQUIREMENTS.maxLength} characters`);
  }
  
  // Check for uppercase
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  // Check for lowercase
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  // Check for numbers
  if (PASSWORD_REQUIREMENTS.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  // Check for special characters
  if (PASSWORD_REQUIREMENTS.requireSpecialChars) {
    const specialCharRegex = new RegExp(`[${PASSWORD_REQUIREMENTS.specialChars.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}]`);
    if (!specialCharRegex.test(password)) {
      errors.push(`Password must contain at least one special character (${PASSWORD_REQUIREMENTS.specialChars})`);
    }
  }
  
  // Calculate password strength score (0-100)
  let strength = 0;
  
  // Length contribution (max 30 points)
  if (password.length >= 8) strength += 10;
  if (password.length >= 10) strength += 10;
  if (password.length >= 12) strength += 10;
  
  // Character type contributions
  if (/[A-Z]/.test(password)) strength += 15;
  if (/[a-z]/.test(password)) strength += 15;
  if (/[0-9]/.test(password)) strength += 15;
  
  // Special character contribution
  const specialCharCount = (password.match(new RegExp(`[${PASSWORD_REQUIREMENTS.specialChars.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}]`, 'g')) || []).length;
  if (specialCharCount >= 1) strength += 15;
  if (specialCharCount >= 2) strength += 10;
  if (specialCharCount >= 3) strength += 5;
  
  // Cap at 100
  strength = Math.min(strength, 100);
  
  return {
    isValid: errors.length === 0,
    errors,
    strength,
    requirements: PASSWORD_REQUIREMENTS
  };
};

/**
 * Check if password has been pwned using Have I Been Pwned API (k-anonymity)
 * @param {string} password - Password to check
 * @returns {Promise<Object>} Breach check result
 */
const checkPasswordBreach = async (password) => {
  try {
    // Create SHA-1 hash of the password
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.substring(0, 5);
    const suffix = sha1.substring(5);
    
    // Call HIBP API with k-anonymity
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    
    if (!response.ok) {
      throw new Error(`HIBP API returned ${response.status}`);
    }
    
    const data = await response.text();
    const hashes = data.split('\n').map(line => line.split(':')[0]);
    
    // Check if our hash suffix appears in the response
    const found = hashes.some(h => h === suffix);
    
    if (found) {
      return {
        breached: true,
        message: 'This password has been exposed in a data breach. Please choose a different password.'
      };
    }
    
    return {
      breached: false,
      message: 'Password not found in known breaches'
    };
  } catch (error) {
    logger.error('HIBP API error:', error);
    // Fail open - don't block registration if HIBP is down
    return {
      breached: false,
      message: 'Unable to check password breaches',
      error: error.message
    };
  }
};

/**
 * Check password against user's password history
 * @param {string} userId - User ID
 * @param {string} newPassword - New password to check
 * @returns {Promise<Object>} History check result
 */
const checkPasswordHistory = async (userId, newPassword) => {
  try {
    const user = await User.findById(userId).select('+passwordHistory +password');
    
    if (!user || !user.passwordHistory || user.passwordHistory.length === 0) {
      return { reused: false };
    }
    
    // Check against current password
    if (user.password) {
      let isSameAsCurrent;
      if (user.password.startsWith('$argon2')) {
        isSameAsCurrent = await argon2.verify(user.password, newPassword);
      } else {
        isSameAsCurrent = await bcrypt.compare(newPassword, user.password);
      }
      if (isSameAsCurrent) {
        return {
          reused: true,
          message: 'You cannot use your current password'
        };
      }
    }
    
    // Check against password history
    for (let i = 0; i < user.passwordHistory.length; i++) {
      const historyItem = user.passwordHistory[i];
      let isMatch;
      if (historyItem.password.startsWith('$argon2')) {
        isMatch = await argon2.verify(historyItem.password, newPassword);
      } else {
        isMatch = await bcrypt.compare(newPassword, historyItem.password);
      }
      if (isMatch) {
        return {
          reused: true,
          message: `You have used this password in the past. Please choose a different password.`,
          index: i
        };
      }
    }
    
    return { reused: false };
  } catch (error) {
    logger.error('Password history check error:', error);
    return { reused: false, error: error.message };
  }
};

/**
 * Check if password needs to be changed (expiration policy)
 * @param {Object} user - User object
 * @returns {Object} Expiration check result
 */
const checkPasswordExpiration = (user) => {
  if (!PASSWORD_REQUIREMENTS.expirationDays) {
    return { expired: false };
  }
  
  if (!user.lastPasswordChange) {
    // New user without password or never changed
    return { expired: false };
  }
  
  const now = new Date();
  const lastChange = new Date(user.lastPasswordChange);
  const daysSinceChange = Math.floor((now - lastChange) / (1000 * 60 * 60 * 24));
  
  const expired = daysSinceChange >= PASSWORD_REQUIREMENTS.expirationDays;
  const daysRemaining = Math.max(0, PASSWORD_REQUIREMENTS.expirationDays - daysSinceChange);
  
  return {
    expired,
    daysSinceChange,
    daysRemaining,
    expirationDays: PASSWORD_REQUIREMENTS.expirationDays,
    warningThreshold: 7 // Warn 7 days before expiration
  };
};

/**
 * Comprehensive password validation
 * @param {string} password - Password to validate
 * @param {string} userId - User ID (optional, for history check)
 * @param {boolean} checkBreach - Whether to check HIBP
 * @returns {Promise<Object>} Comprehensive validation result
 */
const validatePassword = async (password, userId = null, checkBreach = true) => {
  // 1. Check strength
  const strengthResult = checkPasswordStrength(password);
  
  if (!strengthResult.isValid) {
    return {
      isValid: false,
      errors: strengthResult.errors,
      strength: strengthResult.strength
    };
  }
  
  // 2. Check breach (if enabled)
  let breachResult = null;
  if (checkBreach) {
    try {
      breachResult = await checkPasswordBreach(password);
      if (breachResult.breached) {
        return {
          isValid: false,
          errors: [breachResult.message],
          strength: strengthResult.strength,
          breach: breachResult
        };
      }
    } catch (error) {
      logger.error('Breach check failed:', error);
      // Continue if breach check fails
    }
  }
  
  // 3. Check history (if userId provided)
  let historyResult = null;
  if (userId) {
    historyResult = await checkPasswordHistory(userId, password);
    if (historyResult.reused) {
      return {
        isValid: false,
        errors: [historyResult.message],
        strength: strengthResult.strength,
        breach: breachResult,
        history: historyResult
      };
    }
  }
  
  return {
    isValid: true,
    strength: strengthResult.strength,
    breach: breachResult,
    history: historyResult
  };
};

/**
 * Generate a strong random password
 * @param {number} length - Password length (default: 12)
 * @returns {string} Strong random password
 */
const generateStrongPassword = (length = 12) => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = PASSWORD_REQUIREMENTS.specialChars;
  
  const allChars = uppercase + lowercase + numbers + special;
  
  let password = '';
  
  // Ensure at least one of each required character type
  password += uppercase.charAt(crypto.randomInt(0, uppercase.length));
  password += lowercase.charAt(crypto.randomInt(0, lowercase.length));
  password += numbers.charAt(crypto.randomInt(0, numbers.length));
  password += special.charAt(crypto.randomInt(0, special.length));
  
  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars.charAt(crypto.randomInt(0, allChars.length));
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

/**
 * Get password requirements message for frontend
 * @returns {Object} Password requirements
 */
const getPasswordRequirements = () => {
  return {
    minLength: PASSWORD_REQUIREMENTS.minLength,
    maxLength: PASSWORD_REQUIREMENTS.maxLength,
    requireUppercase: PASSWORD_REQUIREMENTS.requireUppercase,
    requireLowercase: PASSWORD_REQUIREMENTS.requireLowercase,
    requireNumbers: PASSWORD_REQUIREMENTS.requireNumbers,
    requireSpecialChars: PASSWORD_REQUIREMENTS.requireSpecialChars,
    specialChars: PASSWORD_REQUIREMENTS.specialChars,
    historyLimit: PASSWORD_REQUIREMENTS.historyLimit,
    expirationDays: PASSWORD_REQUIREMENTS.expirationDays
  };
};

module.exports = {
  checkPasswordStrength,
  checkPasswordBreach,
  checkPasswordHistory,
  checkPasswordExpiration,
  validatePassword,
  generateStrongPassword,
  getPasswordRequirements,
  PASSWORD_REQUIREMENTS
};