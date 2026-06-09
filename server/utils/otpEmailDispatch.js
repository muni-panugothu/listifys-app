'use strict';

const EmailService = require('../services/email.service');
const { publishOTPEmail } = require('../queues/producers/auth.producer');
const { logger } = require('./logger');

/**
 * Send an OTP email without blocking the HTTP response.
 * Tries RabbitMQ first; falls back to a direct SMTP send in the background.
 */
async function dispatchOtpEmail({
  email,
  username,
  otp,
  type = 'registration',
}) {
  const sendDirect = () => {
    const sender =
      type === 'forgot_password'
        ? EmailService.sendForgotPasswordOTPEmail.bind(EmailService)
        : EmailService.sendOTPEmail.bind(EmailService);

    return sender(email, username, otp)
      .then(() => {
        logger.info(`✅ OTP email delivered (${type})`, { email });
      })
      .catch((err) => {
        logger.error(`❌ OTP email delivery failed (${type})`, {
          email,
          error: err.message,
        });
      });
  };

  try {
    const queued = await publishOTPEmail({ email, username, otp, type });
    if (queued) return;
  } catch (err) {
    logger.warn('[dispatchOtpEmail] Queue publish failed — using direct fallback', {
      email,
      error: err.message,
    });
  }

  setImmediate(() => {
    void sendDirect();
  });
}

module.exports = { dispatchOtpEmail };
