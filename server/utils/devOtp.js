'use strict';

/** Expose OTP in API responses when SMTP is unavailable (local/dev only). */
function isDevOtpExposed() {
  if (process.env.NODE_ENV === 'production') return false;
  const flag = process.env.EXPOSE_OTP_IN_RESPONSE;
  if (flag === '0' || flag === 'false') return false;
  return true;
}

module.exports = { isDevOtpExposed };
