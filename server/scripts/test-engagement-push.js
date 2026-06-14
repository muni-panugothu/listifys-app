'use strict';

/**
 * Manual test helper — send an engagement push to one user.
 *
 * Usage (from server/):
 *   node scripts/test-engagement-push.js <userId> morning
 *   node scripts/test-engagement-push.js <userId> morning --force
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const {
  sendEngagementToUser,
  canSendEngagement,
} = require('../services/engagement-notification.service');

const args = process.argv.slice(2).filter((a) => a !== '--force');
const force = process.argv.includes('--force');
const userId = args[0];
const campaign = args[1] || 'fomo';

if (!userId) {
  console.error('Usage: node scripts/test-engagement-push.js <userId> [campaign] [--force]');
  process.exit(1);
}

function prefEnabled(prefs, key) {
  if (!prefs || prefs[key] === undefined || prefs[key] === null) return true;
  return Boolean(prefs[key]);
}

async function diagnoseSkip(user) {
  if (!user?.fcmToken) return 'no fcmToken on user';
  if (!prefEnabled(user.preferences, 'pushNotifications')) return 'pushNotifications disabled';
  if (!prefEnabled(user.preferences, 'engagementNotifications')) return 'engagementNotifications disabled';
  if (!await canSendEngagement(user._id)) return 'rate limit (max per week or min hours between sends)';
  return 'dispatch failed (FCM)';
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findById(userId)
    .select('fcmToken preferences devices.location devices.isCurrentDevice loginHistory.location')
    .lean();
  if (!user) {
    console.error('User not found');
    process.exit(1);
  }

  if (force) {
    console.log('Force mode — skipping prefs and rate limits');
  }

  const ok = await sendEngagementToUser(user, campaign, { force });
  if (ok) {
    console.log('Engagement push sent:', campaign);
  } else {
    const reason = await diagnoseSkip(user);
    console.log('Push skipped:', reason);
    console.log('Tip: use --force to bypass prefs/rate limit for testing');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
