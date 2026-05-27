'use strict';
/**
 * ── Search Analytics Producer ──────────────────────────────────────────────────
 * Publishes search queries to the SEARCH_INDEX queue for analytics tracking.
 * Used to power trending searches, popular terms, and search quality metrics.
 *
 * Non-blocking: if RabbitMQ is down, analytics are silently skipped.
 */

const { publish, QUEUES } = require('../rabbitmq');
const { logger } = require('../../utils/logger');

/**
 * Track a search query for analytics.
 * Called from search routes after returning results.
 *
 * @param {Object} opts
 * @param {string}  opts.query       - Raw search query text
 * @param {string}  opts.entity      - Entity filter ('all' | 'electronics' | etc.)
 * @param {number}  opts.resultCount - Number of results returned
 * @param {string}  opts.source      - 'elasticsearch' | 'mongodb' | 'cache'
 * @param {string}  [opts.userId]    - Authenticated user (if any)
 * @param {string}  [opts.ip]        - Client IP
 * @param {string}  [opts.userAgent] - Client UA
 */
const publishSearchAnalytics = async ({
  query,
  entity,
  resultCount,
  source,
  userId,
  ip,
  userAgent,
}) => {
  if (!query || query.trim().length < 2) return;

  const payload = {
    action: 'search_analytics',
    query: query.trim().toLowerCase(),
    entity: entity || 'all',
    resultCount: resultCount || 0,
    source: source || 'unknown',
    userId: userId || null,
    ip,
    userAgent,
    timestamp: new Date().toISOString(),
  };

  // Use SEARCH_INDEX queue — analytics are low priority, reuse existing queue
  await publish(QUEUES.SEARCH_INDEX.name, payload, { priority: 1 });
};

module.exports = { publishSearchAnalytics };
