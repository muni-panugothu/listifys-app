'use strict';
/**
 * ── Email Consumer ───────────────────────────────────────────────────────────
 * Processes: otp_queue | email_queue | welcome_queue
 * Calls EmailService directly — fully decoupled from the API layer.
 * Runs in the same process but can easily be split into a standalone worker.
 */
const { consume, QUEUES } = require('../rabbitmq');
const EmailService = require('../../services/email.service');
const { logger } = require('../../utils/logger');

// ── Route a message to the correct email handler ────────────────────────────
const dispatchEmail = async (payload) => {
  const { type, email, username, otp, loginDetails, alertType, details } = payload;

  switch (type) {
    // ── OTP Emails ────────────────────────────────────────────────────────────
    case 'registration':
      logger.info('[EmailConsumer] Sending registration OTP email', { email });
      await EmailService.sendOTPEmail(email, username, otp);
      break;

    case 'forgot_password':
      logger.info('[EmailConsumer] Sending forgot-password OTP email', { email });
      await EmailService.sendForgotPasswordOTPEmail(email, username, otp);
      break;

    // ── Welcome Email ─────────────────────────────────────────────────────────
    case 'welcome':
      logger.info('[EmailConsumer] Sending welcome email', { email });
      await EmailService.sendWelcomeEmail(email, username);
      break;

    // ── Login Notification ────────────────────────────────────────────────────
    case 'login_notification':
      logger.info('[EmailConsumer] Sending login notification', { email });
      await EmailService.sendLoginNotificationEmail(email, username, loginDetails);
      break;

    // ── Password Reset Success ────────────────────────────────────────────────
    case 'password_reset_success':
      logger.info('[EmailConsumer] Sending password reset success email', { email });
      await EmailService.sendPasswordResetSuccessEmail(email, username);
      break;

    // ── Security Alert ────────────────────────────────────────────────────────
    case 'security_alert':
      logger.warn('[EmailConsumer] Sending security alert email', { email, alertType });
      // Use login notification template with custom details if no dedicated template
      await EmailService.sendLoginNotificationEmail(email, username, {
        ...(details || {}),
        alertType,
      });
      break;

    default:
      logger.warn('[EmailConsumer] Unknown email type — skipping', { type, email });
  }
};

// ── Start all email consumers ────────────────────────────────────────────────
const startEmailConsumers = async () => {
  // OTP queue — short retry window (OTPs expire fast)
  await consume(QUEUES.OTP.name, async (payload) => {
    await dispatchEmail(payload);
    logger.emailLog('otp_sent', payload.email, 'success');
  }, { maxRetries: 2 });

  // General email queue — welcome, login notifications, password reset, alerts
  await consume(QUEUES.EMAIL.name, async (payload) => {
    await dispatchEmail(payload);
    logger.emailLog(payload.type, payload.email, 'success');
  }, { maxRetries: 3 });

  // Welcome queue
  await consume(QUEUES.WELCOME.name, async (payload) => {
    await dispatchEmail(payload);
    logger.emailLog('welcome', payload.email, 'success');
  }, { maxRetries: 3 });

  logger.info('[EmailConsumer] ✅ All email consumers started');
};

module.exports = { startEmailConsumers };
