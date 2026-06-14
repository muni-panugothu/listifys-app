'use strict';

const { runEngagementCampaign, isEnabled } = require('./engagement-notification.service');
const { logger } = require('../utils/logger');

const TZ = process.env.ENGAGEMENT_TIMEZONE || 'Asia/Kolkata';

let lastSlotKey = null;
let intervalHandle = null;

function getZonedParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: get('weekday'), // Sun, Mon, ...
  };
}

function campaignsForSlot({ hour, minute, day, weekday }) {
  const slots = [];

  if (minute === 30 && hour === 8) slots.push('morning');
  if (minute === 30 && hour === 18) slots.push('evening');
  if (minute === 0 && hour === 10 && (weekday === 'Sun' || weekday === 'Sat')) slots.push('weekend');
  if (minute === 0 && hour === 19 && weekday === 'Wed') slots.push('fomo');
  if (minute === 0 && hour === 10 && day === 1) slots.push('salary');
  if (minute === 0 && hour === 11) slots.push('re_engagement');

  return slots;
}

async function tick() {
  if (!isEnabled()) return;

  const parts = getZonedParts();
  const slotKey = `${parts.year}-${parts.month}-${parts.day}-${parts.hour}-${parts.minute}`;
  if (slotKey === lastSlotKey) return;
  lastSlotKey = slotKey;

  const campaigns = campaignsForSlot(parts);
  if (!campaigns.length) return;

  logger.info('[EngagementScheduler] running slots', { tz: TZ, campaigns, ...parts });

  for (const campaign of campaigns) {
    try {
      await runEngagementCampaign(campaign);
    } catch (err) {
      logger.error('[EngagementScheduler] campaign failed', { campaign, err: err.message });
    }
  }
}

function startEngagementScheduler() {
  if (!isEnabled()) {
    logger.info('[EngagementScheduler] disabled (ENGAGEMENT_NOTIFICATIONS_ENABLED=false)');
    return;
  }

  if (intervalHandle) return;

  logger.info('[EngagementScheduler] started', { timezone: TZ });
  intervalHandle = setInterval(() => {
    tick().catch((err) => logger.error('[EngagementScheduler] tick error', { err: err.message }));
  }, 60_000);

  // Align first tick shortly after boot without double-firing the same minute
  setTimeout(() => {
    tick().catch((err) => logger.error('[EngagementScheduler] initial tick error', { err: err.message }));
  }, 15_000);
}

function stopEngagementScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  startEngagementScheduler,
  stopEngagementScheduler,
  tick,
};
