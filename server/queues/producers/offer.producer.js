'use strict';
/**
 * offer.producer.js — Publishes offer lifecycle events to the offer_queue.
 *
 * Events:
 *   offer.made      — buyer made an offer
 *   offer.accepted  — seller accepted
 *   offer.declined  — seller declined
 *   offer.countered — seller counter-offered
 */
const { publish, QUEUES } = require('../rabbitmq');
const { logger }          = require('../../utils/logger');

// Use the NOTIFICATION queue (already defined) for offer events.
// If you want a dedicated offer_queue, add it to rabbitmq.js QUEUES.
// For now we route via notification queue with type='offer.*'
const QUEUE = QUEUES.NOTIFICATION.name;

/**
 * Publish an offer lifecycle event.
 *
 * @param {object} p
 * @param {string} p.type          — 'offer.made' | 'offer.accepted' | 'offer.declined'
 * @param {string} p.threadId
 * @param {string} p.buyerId
 * @param {string} p.sellerId
 * @param {number} [p.amount]
 * @param {string} [p.currency]
 * @param {string} [p.productTitle]
 */
exports.publishOfferEvent = async ({
  type,
  threadId,
  buyerId,
  sellerId,
  amount,
  currency,
  productTitle,
}) => {
  try {
    await publish(QUEUE, {
      type,
      threadId:     threadId || null,
      buyerId:      buyerId  || null,
      sellerId:     sellerId || null,
      amount:       amount   || null,
      currency:     currency || '₹',
      productTitle: (productTitle || '').slice(0, 120),
      timestamp:    Date.now(),
    });
  } catch (err) {
    logger.error('[OfferProducer] publishOfferEvent error', { error: err.message, type });
  }
};
