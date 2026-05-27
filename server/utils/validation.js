// No require statements to update in this file
const validateEmail=(email)=>{
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email)
}

const validatePassword = (password) => {
  if (!password || password.length < 8) return false;
  if (password.length > 128) return false;
  // Must contain: uppercase, lowercase, number, special char
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  return hasUpperCase && hasLowerCase && hasNumber && hasSpecial;
};

const validateName = (name) => {
  return name && name.trim().length > 0 && name.length <= 50;
};

const validatePhone = (phone) => {
  const normalized = String(phone || '').trim().replace(/\s|\-|\(|\)/g, '');
  return /^\+?[0-9]{7,15}$/.test(normalized);
};

// Register validation with confirm password
const validateRegisterInput = (data) => {
  const errors = {};
  
  // Name validation
  if (!validateName(data.name)) {
    errors.name = 'Name is required and should be 1-50 characters';
  }
  
  // Email validation
  if (!validateEmail(data.email)) {
    errors.email = 'Please provide a valid email address';
  }
  
  // Password validation
  if (!validatePassword(data.password)) {
    errors.password = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
  }
  
  // No confirmPassword validation
  
  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

// Login validation
const validateLoginInput = (data) => {
  const errors = {};

  const identity = (data.identity || data.email || data.phone || '').trim();
  const looksLikeEmail = identity.includes('@');

  // Identity validation (email or phone)
  if (!identity) {
    errors.identity = 'Please provide email or phone number';
  } else if (looksLikeEmail && !validateEmail(identity)) {
    errors.identity = 'Please provide a valid email address';
  } else if (!looksLikeEmail && !validatePhone(identity)) {
    errors.identity = 'Please provide a valid phone number';
  }
  
  // Password validation
  if (!data.password || data.password.trim() === '') {
    errors.password = 'Password is required';
  }
  
  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

// Profile update validation
const validateProfileUpdateInput = (data) => {
  const errors = {};
  
  if (data.name && !validateName(data.name)) {
    errors.name = 'Name should be 1-50 characters';
  }
  
  if (data.email && !validateEmail(data.email)) {
    errors.email = 'Please provide a valid email address';
  }
  
  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

// Change password validation
const validateChangePasswordInput = (data) => {
  const errors = {};
  
  if (!data.currentPassword || data.currentPassword.trim() === '') {
    errors.currentPassword = 'Current password is required';
  }
  
  if (!data.newPassword || !validatePassword(data.newPassword)) {
    errors.newPassword = 'New password must be at least 8 characters with uppercase, lowercase, number, and special character';
  }
  
  if (data.newPassword === data.currentPassword) {
    errors.newPassword = 'New password must be different from current password';
  }
  
  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

// Forgot password validation
const validateForgotPasswordInput = (data) => {
  const errors = {};
  
  if (!data.email || !validateEmail(data.email)) {
    errors.email = 'Please provide a valid email address';
  }
  
  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

// Reset password validation
const validateResetPasswordInput = (data) => {
  const errors = {};
  
  if (!data.password || !validatePassword(data.password)) {
    errors.password = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
  }
  
  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

module.exports = {
  validateRegisterInput,
  validateLoginInput,
  validateProfileUpdateInput,
  validateChangePasswordInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
  validateEmail,
  validatePassword,
  validateName
};