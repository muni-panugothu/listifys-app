'use strict';
/**
 * ── Security Notification Service ───────────────────────────────────────────
 *
 * Detects new device/location logins and sends push notifications (FCM)
 * to alert account owners of suspicious sign-in activity.
 *
 * Inspired by: Google Security, Flipkart, Facebook, Microsoft, LinkedIn alerts.
 */
const { logger } = require('../utils/logger');
const fcmService = require('./fcm.service');
const deviceService = require('./device.service');

/**
 * Determine if a login is from a new device or significantly different location.
 *
 * @param {Object} user       - Mongoose user doc (with `devices` and `loginHistory`)
 * @param {Object} newSession - The device session created for this login
 * @returns {{ isNewDevice: boolean, isNewLocation: boolean }}
 */
function detectNewLoginContext(user, newSession) {
  const existingDevices = user.devices || [];
  const newDeviceId = newSession.deviceId;

  // ── New Device Detection ─────────────────────────────────────────────────
  const knownDevice = existingDevices.find(
    (d) => d.deviceId === newDeviceId
  );
  // A device is "new" if it hasn't been seen before at all
  const isNewDevice = !knownDevice;

  // ── New Location Detection ───────────────────────────────────────────────
  let isNewLocation = false;
  if (newSession.location && newSession.location.city) {
    const previousCities = new Set(
      existingDevices
        .filter((d) => d.location && d.location.city)
        .map((d) => `${d.location.city}|${d.location.region || ''}`)
    );
    const currentCityKey = `${newSession.location.city}|${newSession.location.region || ''}`;
    isNewLocation = previousCities.size > 0 && !previousCities.has(currentCityKey);
  }

  return { isNewDevice, isNewLocation };
}

/**
 * Format location string from device session location object.
 * @param {Object} location - { city, region, country, timezone }
 * @returns {string} e.g. "Hyderabad, Telangana, India"
 */
function formatLocationString(location) {
  if (!location) return 'Unknown Location';
  if (location.city === 'Local') return 'Local Network';

  let country = location.country || '';
  if (country && country.length === 2 && country !== 'Local') {
    try {
      const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
      country = countryNames.of(country) || country;
    } catch (_) { /* keep ISO code */ }
  }

  const parts = [location.city, location.region, country].filter(
    (p) => p && p !== 'Local' && p !== 'Development'
  );
  return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
}

/**
 * Format login time in a human-readable form with timezone.
 * @param {Date} date
 * @param {string} [timezone] - IANA timezone, e.g. 'Asia/Kolkata'
 * @returns {string} e.g. "08:49 PM IST"
 */
function formatLoginTime(date, timezone) {
  try {
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    };
    if (timezone) options.timeZone = timezone;
    return new Intl.DateTimeFormat('en-IN', options).format(date);
  } catch (_) {
    return date.toLocaleTimeString();
  }
}

/**
 * Send a security push notification to the account owner when a new
 * device or new location login is detected.
 *
 * @param {Object} user         - The Mongoose user document
 * @param {Object} deviceSession - The new device session object
 * @param {Object} options
 * @param {boolean} options.isNewDevice
 * @param {boolean} options.isNewLocation
 */
async function sendNewLoginSecurityNotification(user, deviceSession, { isNewDevice, isNewLocation }) {
  const fcmToken = user.fcmToken;
  if (!fcmToken) {
    logger.debug('[SecurityNotification] No FCM token for user — skipping push', {
      userId: user._id?.toString(),
    });
    return;
  }

  // Don't send security alerts for local development logins
  if (deviceSession.location?.city === 'Local') return;

  const deviceName = deviceSession.deviceName || 'Unknown Device';
  const locationStr = formatLocationString(deviceSession.location);
  const loginTime = formatLoginTime(new Date(), deviceSession.location?.timezone);

  const title = '🔐 New Login Detected';
  const body = [
    'A new sign-in to your Listify account was detected.',
    '',
    `Device: ${deviceName}`,
    `Location: ${locationStr}`,
    `Time: ${loginTime}`,
    '',
    "If this wasn't you, TAP TO TAKE ACTION immediately.",
  ].join('\n');

  // Build notification metadata
  const notificationId = `security_${user._id}_${Date.now()}`;
  const alertDetails = {
    deviceId: deviceSession.deviceId,
    deviceName,
    deviceType: deviceSession.deviceType || 'unknown',
    ipAddress: deviceSession.ipAddress || '',
    city: deviceSession.location?.city || '',
    state: deviceSession.location?.region || '',
    country: deviceSession.location?.country || '',
    timezone: deviceSession.location?.timezone || '',
    loginTime: new Date().toISOString(),
    isNewDevice: String(isNewDevice),
    isNewLocation: String(isNewLocation),
  };

  try {
    await fcmService.sendRichNotification(fcmToken, {
      notificationId,
      type: 'security_alert',
      title,
      body,
      route: '/security-alert',
      params: alertDetails,
      actions: [
        { id: 'secure_account', title: '🔒 Secure Account' },
        { id: 'dismiss', title: '✓ This Was Me' },
      ],
      groupKey: 'security',
      sound: 'default',
      extra: alertDetails,
    });

    logger.info('[SecurityNotification] New login alert sent', {
      userId: user._id?.toString(),
      device: deviceName,
      location: locationStr,
      isNewDevice,
      isNewLocation,
    });
  } catch (err) {
    logger.warn('[SecurityNotification] Failed to send push', {
      error: err.message,
      userId: user._id?.toString(),
    });
  }
}

/**
 * Main entry point: Check login context and send notification if warranted.
 * Called from the auth controller after successful login.
 *
 * @param {Object} user         - Mongoose user document
 * @param {Object} deviceSession - The device session object for this login
 */
async function checkAndNotifyNewLogin(user, deviceSession) {
  try {
    const { isNewDevice, isNewLocation } = detectNewLoginContext(user, deviceSession);

    if (isNewDevice || isNewLocation) {
      await sendNewLoginSecurityNotification(user, deviceSession, {
        isNewDevice,
        isNewLocation,
      });
    }
  } catch (err) {
    // Non-blocking — never let security notifications break login
    logger.warn('[SecurityNotification] checkAndNotifyNewLogin failed', {
      error: err.message,
    });
  }
}

module.exports = {
  detectNewLoginContext,
  formatLocationString,
  formatLoginTime,
  sendNewLoginSecurityNotification,
  checkAndNotifyNewLogin,
};
