'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { initializeMessaging, shutdownMessaging } = require('../messaging');
const ConsumerService = require('../messaging/ConsumerService');
const { QUEUES }      = require('../messaging/config/messaging.config');
const { logger }      = require('../utils/logger');

/**
 * ImageWorker — async image processing pipeline.
 * Subscribes to image.processing.q (listing.created + listing.updated events).
 *
 * Typical work: resize, generate thumbnails, upload to CDN, update DB with CDN URLs.
 */
async function handleImageProcessing(payload) {
  const { listingId, images } = payload;
  if (!images?.length) return;
  logger.info('[ImageWorker] Processing images', { listingId, count: images.length });
  // await ImageService.processAndUpload(listingId, images);
}

async function start() {
  logger.info('[ImageWorker] 🚀 Starting...');

  await initializeMessaging({ startMonitoring: false, startDLQProcessing: false });

  await ConsumerService.consume(
    QUEUES.IMAGE_PROCESSING.name,
    (payload) => handleImageProcessing(payload),
    // Image processing is CPU/IO heavy — low prefetch to avoid memory spikes
    { maxRetries: 3, prefetch: 3 },
  );

  logger.info('[ImageWorker] ✅ Ready');

  async function shutdown(signal) {
    logger.info(`[ImageWorker] ${signal} — shutting down`);
    await shutdownMessaging();
    process.exit(0);
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('[ImageWorker] Fatal', { error: err.message });
  process.exit(1);
});
