'use strict';

/**
 * Send a test FCM push to your phone (single-device testing).
 *
 * Usage (from server/):
 *   node scripts/test-fcm-push.js <userId>
 *   node scripts/test-fcm-push.js --token <fcm_token>
 *
 * Get userId from MongoDB users collection, or copy FCM token from Metro log:
 *   [FCM] Device token: ...
 */
require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/user.model');
const { sendRichNotification } = require('../services/fcm.service');

function resolveFirebaseProjectId() {
  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (configuredPath) {
    const resolvedPath = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(__dirname, '..', configuredPath);
    try {
      return require(resolvedPath).project_id;
    } catch {
      // fall through
    }
  }
  return process.env.FIREBASE_PROJECT_ID || 'unknown';
}

const arg1 = process.argv[2];
const arg2 = process.argv[3];

async function resolveToken() {
  if (arg1 === '--token' && arg2) return arg2;

  if (!arg1) {
    console.error('Usage: node scripts/test-fcm-push.js <userId>');
    console.error('       node scripts/test-fcm-push.js --token <fcm_token>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findById(arg1).select('fcmToken email name').lean();
  if (!user) {
    console.error('User not found:', arg1);
    process.exit(1);
  }
  if (!user.fcmToken) {
    console.error('No fcmToken on user. Open the app, sign in, allow notifications, then retry.');
    console.error('User:', user.email || user.name || arg1);
    process.exit(1);
  }
  console.log('User:', user.email || user.name || arg1);
  console.log('FCM token (first 40 chars):', user.fcmToken.slice(0, 40) + '...');
  return user.fcmToken;
}

async function main() {
  const token = await resolveToken();

  const projectId = resolveFirebaseProjectId();
  console.log('Firebase Admin project:', projectId);
  console.log('App google-services.json project should match: listifys');

  await sendRichNotification(token, {
    notificationId: `test_${Date.now()}`,
    type: 'engagement_digest',
    title: '✅ Listifys push test',
    body: 'If you see this, FCM + google-services.json are working!',
    route: '/(tabs)/home-feed-root',
    actions: [{ id: 'browse', title: '🔍 Open app' }],
    groupKey: 'promotions',
  });

  console.log('Test push sent. Check your phone (foreground + background).');
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  if (/not found|mismatch|registration-token/i.test(err.message)) {
    console.error('\nCommon fixes:');
    console.error('1. Server Firebase project must match app google-services.json (project listifys / 582870381419)');
    console.error('2. Rebuild app after changing google-services.json');
    console.error('3. Sign in again so a fresh FCM token is saved on the user');
  }
  process.exit(1);
});
