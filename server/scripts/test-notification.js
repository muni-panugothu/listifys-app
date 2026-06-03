/**
 * Quick test: push an in_app_notification through the RabbitMQ queue.
 * Usage:
 *   node scripts/test-notification.js <recipientUserId>
 *
 * Example:
 *   node scripts/test-notification.js 663f1a2b4e8c3d001f5a9abc
 */
'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const { publishToQueue, QUEUES } = require('../queues/rabbitmq');

const [,, recipientId] = process.argv;

if (!recipientId || !mongoose.isValidObjectId(recipientId)) {
  logger.error('Usage: node scripts/test-notification.js <recipientUserId>');
  process.exit(1);
}

async function main() {
  // Connect to MongoDB (needed by the consumer to create the Notification doc)
  await mongoose.connect(process.env.MONGODB_URI);
  logger.info('[test] MongoDB connected');

  const payload = {
    type:       'in_app_notification',
    recipient:  recipientId,
    sender:     recipientId, // use same ID as placeholder; adjust if needed
    notifType:  'system',
    message:    '🎉 Test notification from server — notifications are working!',
    metadata:   { test: true },
    socketEvent: null,
  };

  await publishToQueue(QUEUES.NOTIFICATION, payload);
  logger.info('[test] Notification published to queue', { payload });

  // Give the consumer a moment to process, then exit
  await new Promise(r => setTimeout(r, 2000));
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  logger.error('[test] Failed', { error: err.message });
  process.exit(1);
});
