'use strict';

const connectionManager = require('./connection/connection.manager');
const QueueManager      = require('./QueueManager');
const ProducerService   = require('./ProducerService');
const ConsumerService   = require('./ConsumerService');
const EventBusService   = require('./EventBusService');
const DeadLetterService = require('./DeadLetterService');
const RetryService      = require('./RetryService');
const MetricsService    = require('./MetricsService');
const MonitoringService = require('./MonitoringService');
const { logger }        = require('../utils/logger');

/**
 * initializeMessaging — bootstrap the full messaging infrastructure.
 * Call ONCE at server/worker startup, before registering consumers.
 *
 * Steps:
 *  1. Connect to RabbitMQ
 *  2. Declare full topology (exchanges, queues, bindings)
 *  3. Start DLQ consumers (so dead letters are never silently dropped)
 *  4. Start queue-depth monitoring
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.startMonitoring=true]    Start 30-s depth polling
 * @param {boolean} [opts.startDLQProcessing=true] Start DLQ consumers
 */
async function initializeMessaging({
  startMonitoring   = true,
  startDLQProcessing = true,
} = {}) {
  logger.info('[Messaging] Initializing...');

  // 1. Connect
  await connectionManager.connect();

  // 2. Declare topology
  await QueueManager.initialize();

  // 3. DLQ consumers — register domain-specific handlers first
  if (startDLQProcessing) {
    const { registerDLQHandlers } = require('../dlq/dlq.processor');
    registerDLQHandlers();
    await DeadLetterService.startAll();
  }

  // 4. Queue depth monitoring
  if (startMonitoring) {
    MonitoringService.start();
  }

  logger.info('[Messaging] ✅ Ready');

  return {
    connectionManager,
    QueueManager,
    ProducerService,
    ConsumerService,
    EventBusService,
    DeadLetterService,
    RetryService,
    MetricsService,
    MonitoringService,
  };
}

/**
 * shutdownMessaging — graceful shutdown.
 * Call on SIGTERM/SIGINT before process.exit().
 */
async function shutdownMessaging() {
  logger.info('[Messaging] Shutting down...');
  MonitoringService.stop();
  await ConsumerService.closeAll();
  await connectionManager.close();
  logger.info('[Messaging] Shutdown complete');
}

module.exports = {
  initializeMessaging,
  shutdownMessaging,
  // Re-export singletons for convenience
  connectionManager,
  QueueManager,
  ProducerService,
  ConsumerService,
  EventBusService,
  DeadLetterService,
  RetryService,
  MetricsService,
  MonitoringService,
};
