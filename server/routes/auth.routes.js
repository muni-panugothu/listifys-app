const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const tokenController = require("../controllers/token.controller");
const upload = require("../middleware/upload.middleware");
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateProfileUpdate,
  validateChangePassword,
  validateOTPVerification,
  validatePasswordSecurity,
  getPasswordRequirements,
} = require("../middleware/validation.middleware");
const {
  protect,
  optionalAuth,
  refreshToken,
  logout,
  logoutAll,
  authorize,
} = require("../middleware/auth.middleware");

// ==================== PASSWORD SECURITY ENDPOINTS ====================
router.get("/password-requirements", getPasswordRequirements);
router.get(
  "/password-expiration",
  protect,
  authController.checkPasswordExpiration,
);

// ==================== PROFILE IMAGE UPLOAD ROUTES ====================
const { optimiseProfileImage } = require("../middleware/upload.middleware");
router.post(
  "/profile/upload-image",
  protect,
  upload.single("image"),
  optimiseProfileImage,
  authController.uploadProfileImage,
);

router.post(
  "/profile/generate-upload-url",
  protect,
  authController.generateUploadUrl,
);

// ==================== DEVICE & SESSION ROUTES ====================
router.get("/devices", protect, authController.getUserDevices);
router.get("/login-history", protect, authController.getLoginHistory);
router.get("/activity-log", protect, authController.getActivityLog);
router.delete("/devices/:deviceId", protect, authController.revokeDevice);

// ==================== OTP-based Registration routes ====================
router.post(
  "/register/initiate",
  validateRegister,
  validatePasswordSecurity,
  authController.initiateRegister,
);
router.post(
  "/register/verify",
  validateOTPVerification,
  authController.verifyOTPAndRegister,
);
router.post("/register/resend-otp", authController.resendOTP);
router.get("/register/status/:email", authController.checkRegistrationStatus);

// ==================== OTP-based Forgot Password routes ====================
router.post(
  "/forgot-password/initiate",
  validateForgotPassword,
  authController.initiateForgotPassword,
);
router.post(
  "/forgot-password/verify-otp",
  validateOTPVerification,
  authController.verifyForgotPasswordOTP,
);
router.post(
  "/forgot-password/resend-otp",
  authController.resendForgotPasswordOTP,
);
router.put(
  "/reset-password/:resetToken",
  validateResetPassword,
  validatePasswordSecurity,
  authController.resetPasswordWithToken,
);

// ==================== Password setup for users without passwords ====================
// SECURITY: Must be authenticated — without `protect` anyone could set
// a password on any user's account by providing their email.
router.post(
  "/setup-password",
  protect,
  validatePasswordSecurity,
  authController.setupPassword,
);

// ==================== Legacy routes (keep for compatibility) ====================
router.post(
  "/forgot-password",
  validateForgotPassword,
  authController.forgotPassword,
);
router.put(
  "/reset-password-legacy/:resetToken",
  validateResetPassword,
  validatePasswordSecurity,
  authController.resetPassword,
);

// ==================== Google OAuth routes ====================
router.get("/google/client-id", authController.getGoogleClientId);
router.get("/google/client-ids", authController.getGoogleClientIds);
router.post("/google/token", authController.googleTokenAuth);

// ==================== Phone Auth routes (Twilio SMS OTP) ====================
router.post("/phone/send-otp", authController.phoneSendOTP);
router.post("/phone/verify-otp", authController.phoneVerifyOTP);

// ==================== Existing routes ====================
router.post("/login", validateLogin, authController.login);
router.post(
  "/register-legacy",
  validateRegister,
  validatePasswordSecurity,
  authController.register,
);

// ==================== Refresh token & logout routes ====================
router.post("/refresh", refreshToken);
router.post("/logout", logout);
router.post("/logout-all", protect, logoutAll);
router.get("/sessions", protect, tokenController.getUserSessions);
router.delete("/sessions/:tokenId", protect, tokenController.revokeSession);

// ==================== Admin routes (role-gated) ====================
router.get(
  "/admin/sessions/:userId",
  protect,
  authorize('admin'),
  tokenController.adminGetUserSessions,
);
router.post(
  "/admin/cleanup-tokens",
  protect,
  authorize('admin'),
  tokenController.adminCleanupTokens,
);

// ==================== Check authentication status ====================
router.get("/check", authController.checkAuth);

// ==================== Seller profile (public, auth optional for follow status) ====================
router.get("/seller/:userId", optionalAuth, authController.getSellerProfile);
router.get("/seller/:userId/listings", optionalAuth, authController.getSellerListings);

// ==================== Follow / Unfollow ====================
router.post("/follow/:userId", protect, authController.toggleFollow);

// ==================== Get my followers / following list ====================
router.get("/followers", protect, authController.getMyFollowers);

// ==================== Protected routes ====================
router.get("/profile", protect, authController.getProfile);
router.put(
  "/update-profile",
  protect,
  validateProfileUpdate,
  authController.updateProfile,
);
router.put("/upload-profile-image", protect, authController.uploadProfileImage);
router.post(
  "/change-password",
  protect,
  validateChangePassword,
  validatePasswordSecurity,
  authController.changePassword,
);

// ==================== Email Change (OTP-verified) ====================
router.post("/request-email-change", protect, authController.requestEmailChange);
router.post("/verify-email-change", protect, authController.verifyEmailChange);

module.exports = router;
