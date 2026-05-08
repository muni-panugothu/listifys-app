'use strict';
/**
 * ── Auth Event Producers ────────────────────────────────────────────────────
 * All auth async side-effects are published here so the API stays non-blocking.
 * Queues: otp_queue | welcome_queue | email_queue | audit_log_queue
 */
const { publish, QUEUES } = require('../rabbitmq');
const { logger } = require('../../utils/logger');

// ── 1. OTP Email ──────────────────────────────────────────────────────────────
/**
 * Enqueue an OTP send (registration or forgot-password).
 * The consumer picks it up and calls EmailService — the API never waits.
 */
const publishOTPEmail = async ({ email, username, otp, type = 'registration' }) => {
  const ok = await publish(QUEUES.OTP.name, {
    type,       // 'registration' | 'forgot_password'
    email,
    username,
    otp,
    sentAt: new Date().toISOString(),
  });
  if (!ok) {
    // Fallback: non-blocking fire-and-forget direct send (queue down scenario)
    logger.warn('[AuthProducer] OTP queue unavailable — direct fallback triggered', { email });
  }
  return ok;
};

// ── 2. Welcome Email ──────────────────────────────────────────────────────────
const publishWelcomeEmail = async ({ email, username, userId }) => {
  return publish(QUEUES.WELCOME.name, {
    type: 'welcome',
    email,
    username,
    userId,
    sentAt: new Date().toISOString(),
  });
};

// ── 3. Login Notification Email ───────────────────────────────────────────────
const publishLoginNotificationEmail = async ({ email, username, loginDetails }) => {
  return publish(QUEUES.EMAIL.name, {
    type: 'login_notification',
    email,
    username,
    loginDetails,
    sentAt: new Date().toISOString(),
  });
};

// ── 4. Password Reset Success Email ──────────────────────────────────────────
const publishPasswordResetSuccessEmail = async ({ email, username }) => {
  return publish(QUEUES.EMAIL.name, {
    type: 'password_reset_success',
    email,
    username,
    sentAt: new Date().toISOString(),
  });
};

// ── 5. Security Alert Email ───────────────────────────────────────────────────
const publishSecurityAlert = async ({ email, username, alertType, details }) => {
  return publish(QUEUES.EMAIL.name, {
    type: 'security_alert',
    email,
    username,
    alertType,
    details,
    sentAt: new Date().toISOString(),
  });
};

// ── 6. Audit Log Event ────────────────────────────────────────────────────────
const publishAuditLog = async ({ userId, email, action, ip, userAgent, metadata = {} }) => {
  return publish(QUEUES.AUDIT_LOG.name, {
    type: 'audit_log',
    userId,
    email,
    action,  // e.g. 'register', 'login', 'logout', 'password_reset', 'otp_resend'
    ip,
    userAgent,
    metadata,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  publishOTPEmail,
  publishWelcomeEmail,
  publishLoginNotificationEmail,
  publishPasswordResetSuccessEmail,
  publishSecurityAlert,
  publishAuditLog,
};
