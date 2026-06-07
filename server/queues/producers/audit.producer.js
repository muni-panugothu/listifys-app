'use strict';
/**
 * audit.producer.js — Publishes audit trail events to the audit_log_queue.
 *
 * Used for:
 *   - thread.closed     (product sold / manually closed)
 *   - message.deleted   (for-everyone deletion)
 *   - offer.made / accepted / declined
 */
const { publish, QUEUES } = require('../rabbitmq');
const { logger }          = require('../../utils/logger');

const QUEUE = QUEUES.AUDIT_LOG.name;

/**
 * Publish an audit event.
 *
 * @param {object} p
 * @param {string} p.action    — e.g. 'thread.closed', 'message.deleted'
 * @param {string} p.userId    — actor
 * @param {string} [p.threadId]
 * @param {string} [p.messageId]
 * @param {string} [p.conversationId]
 * @param {string} [p.reason]
 * @param {object} [p.meta]    — extra context
 */
exports.publishAuditEvent = async ({
  action,
  userId,
  threadId,
  messageId,
  conversationId,
  reason,
  meta,
}) => {
  try {
    await publish(QUEUE, {
      action,
      userId:         userId         || null,
      threadId:       threadId       || null,
      messageId:      messageId      || null,
      conversationId: conversationId || null,
      reason:         reason         || null,
      meta:           meta           || {},
      timestamp:      Date.now(),
    });
  } catch (err) {
    // Non-fatal: audit failure must never break the main flow
    logger.warn('[AuditProducer] publishAuditEvent error', { error: err.message, action });
  }
};
