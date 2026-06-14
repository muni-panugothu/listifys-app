'use strict';

const User = require('../models/user.model');
const EngagementNotificationLog = require('../models/engagement-notification-log.model');
const Notification = require('../models/notification.model');
const { encrypt } = require('./encryption.service');
const { buildEngagementMessage } = require('../config/engagement-notification.templates');
const {
  buildFcmPayload,
  dispatchPushToUser,
  resolveUserArea,
} = require('./notification-push.service');
const { logger } = require('../utils/logger');

const MAX_ENGAGEMENT_PER_WEEK = parseInt(process.env.ENGAGEMENT_MAX_PER_WEEK, 10) || 4;
const MIN_HOURS_BETWEEN = parseInt(process.env.ENGAGEMENT_MIN_HOURS_BETWEEN, 10) || 20;
const BATCH_SIZE = parseInt(process.env.ENGAGEMENT_BATCH_SIZE, 10) || 200;
const RE_ENGAGE_DAYS = parseInt(process.env.ENGAGEMENT_RE_ENGAGE_DAYS, 10) || 3;

/** Schema defaults to true — treat missing prefs as enabled (legacy users). */
function prefEnabled(prefs, key) {
  if (!prefs || prefs[key] === undefined || prefs[key] === null) return true;
  return Boolean(prefs[key]);
}

function isEnabled() {
  return process.env.ENGAGEMENT_NOTIFICATIONS_ENABLED !== 'false';
}

async function canSendEngagement(userId) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentCount = await EngagementNotificationLog.countDocuments({
    userId,
    sentAt: { $gte: weekAgo },
  });
  if (recentCount >= MAX_ENGAGEMENT_PER_WEEK) return false;

  const last = await EngagementNotificationLog.findOne({ userId })
    .sort({ sentAt: -1 })
    .select('sentAt')
    .lean();
  if (last?.sentAt) {
    const hoursSince = (Date.now() - last.sentAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince < MIN_HOURS_BETWEEN) return false;
  }
  return true;
}

async function sendEngagementToUser(user, campaign, options = {}) {
  const { force = false } = options;

  if (!user?.fcmToken) return false;
  if (!force) {
    if (!prefEnabled(user.preferences, 'pushNotifications')) return false;
    if (!prefEnabled(user.preferences, 'engagementNotifications')) return false;
    if (!await canSendEngagement(user._id)) return false;
  }

  const area = resolveUserArea(user);
  const { title, body, poolKey } = buildEngagementMessage(campaign, area);
  const notifType = campaign === 're_engagement' ? 're_engagement' : 'engagement_digest';

  const notification = await Notification.create({
    recipient: user._id,
    sender: user._id,
    type: notifType,
    message: encrypt(body),
    route: '/(tabs)/home-feed-root',
    groupKey: 'promotions',
    metadata: { campaign, poolKey, engagement: true },
  });

  const payload = buildFcmPayload({
    notificationId: notification._id,
    notifType,
    title,
    message: body,
    metadata: { campaign, poolKey },
  });

  const sent = await dispatchPushToUser(user._id, payload, {
    transactional: false,
    forceEngagement: force,
  });
  if (!sent) return false;

  await Notification.findByIdAndUpdate(notification._id, { $set: { pushSent: true } });
  await EngagementNotificationLog.create({
    userId: user._id,
    campaign,
    title,
    body,
  });

  return true;
}

async function runEngagementCampaign(campaign) {
  if (!isEnabled()) return { campaign, sent: 0 };

  const query = {
    fcmToken: { $ne: null },
    status: 'active',
    'preferences.pushNotifications': true,
    'preferences.engagementNotifications': true,
  };

  if (campaign === 're_engagement') {
    const inactiveSince = new Date(Date.now() - RE_ENGAGE_DAYS * 24 * 60 * 60 * 1000);
    query.$or = [
      { lastLogin: { $lt: inactiveSince } },
      { lastLogin: { $exists: false } },
    ];
  }

  let sent = 0;
  let processed = 0;
  let skip = 0;

  while (true) {
    const users = await User.find(query)
      .select('fcmToken preferences devices.location devices.isCurrentDevice loginHistory.location')
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    if (!users.length) break;

    for (const user of users) {
      processed += 1;
      try {
        const ok = await sendEngagementToUser(user, campaign);
        if (ok) sent += 1;
      } catch (err) {
        logger.warn('[Engagement] user send failed', { userId: user._id, err: err.message });
      }
    }

    skip += users.length;
    if (users.length < BATCH_SIZE) break;
  }

  logger.info('[Engagement] campaign complete', { campaign, sent, processed });
  return { campaign, sent, processed };
}

module.exports = {
  isEnabled,
  runEngagementCampaign,
  sendEngagementToUser,
  canSendEngagement,
};
