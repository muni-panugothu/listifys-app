'use strict';

/**
 * Bulk open/close ProductThreads when a listing is sold, re-listed, or deleted.
 * Uses updateMany + insertMany instead of per-thread loops for speed.
 */

const ProductThread = require('../models/product-thread.model');
const Message = require('../models/message.model');
const Conversation = require('../models/conversation.model');
const { getIO } = require('../config/socket');
const { logger } = require('../utils/logger');

function emitThreadClosed(threads, reason) {
  try {
    const io = getIO();
    const now = new Date();
    for (const thread of threads) {
      io.to(`conversation:${thread.conversation}`).emit('thread:closed', {
        threadId: String(thread._id),
        status: reason === 'deleted' ? 'closed' : 'sold',
        closedReason: reason,
        closedAt: now,
      });
    }
  } catch {
    // socket optional
  }
}

function emitThreadReopened(threads) {
  try {
    const io = getIO();
    for (const thread of threads) {
      io.to(`conversation:${thread.conversation}`).emit('thread:reopened', {
        threadId: String(thread._id),
        status: 'active',
      });
    }
  } catch {
    // socket optional
  }
}

async function bumpConversationCounts(threads, delta) {
  if (!threads.length || !delta) return;
  const counts = {};
  for (const t of threads) {
    const cid = String(t.conversation);
    counts[cid] = (counts[cid] || 0) + 1;
  }
  await Promise.all(
    Object.entries(counts).map(([cid, count]) =>
      Conversation.updateOne(
        { _id: cid },
        { $inc: { activeThreadCount: delta * count } },
      ),
    ),
  );
}

/**
 * Close all active threads for a listing (sold or deleted).
 */
async function closeThreadsForListing({
  listingId,
  category,
  userId,
  reason = 'sold',
  systemMessage = 'Product marked as sold. Conversation closed.',
}) {
  const threads = await ProductThread.find({
    'product.productId': listingId,
    'product.productType': category,
    status: 'active',
  }).lean();

  if (!threads.length) return 0;

  const now = new Date();
  const threadStatus = reason === 'deleted' ? 'closed' : 'sold';

  await ProductThread.updateMany(
    { _id: { $in: threads.map((t) => t._id) } },
    {
      $set: {
        status: threadStatus,
        closedReason: reason,
        closedAt: now,
      },
    },
  );

  await bumpConversationCounts(threads, -1);

  const inserted = await Message.insertMany(
    threads.map((t) => ({
      conversation: t.conversation,
      productThread: t._id,
      sender: userId,
      content: systemMessage,
      messageType: 'system',
      readBy: [userId],
      status: 'sent',
    })),
  );

  await Promise.all(
    threads.map((t, i) =>
      Conversation.updateOne(
        { _id: t.conversation },
        { $set: { lastMessage: inserted[i]._id } },
      ),
    ),
  );

  emitThreadClosed(threads, reason);
  return threads.length;
}

/**
 * Re-open threads that were closed because the listing was marked sold/inactive.
 */
async function reopenThreadsForListing({
  listingId,
  category,
  userId,
  systemMessage = 'Listing is active again. You can continue chatting.',
}) {
  const threads = await ProductThread.find({
    'product.productId': listingId,
    'product.productType': category,
    status: { $in: ['sold', 'closed'] },
    closedReason: { $in: ['sold', null] },
  }).lean();

  if (!threads.length) return 0;

  await ProductThread.updateMany(
    { _id: { $in: threads.map((t) => t._id) } },
    {
      $set: {
        status: 'active',
        closedReason: null,
        closedAt: null,
      },
    },
  );

  await bumpConversationCounts(threads, 1);

  const inserted = await Message.insertMany(
    threads.map((t) => ({
      conversation: t.conversation,
      productThread: t._id,
      sender: userId,
      content: systemMessage,
      messageType: 'system',
      readBy: [userId],
      status: 'sent',
    })),
  );

  await Promise.all(
    threads.map((t, i) =>
      Conversation.updateOne(
        { _id: t.conversation },
        { $set: { lastMessage: inserted[i]._id } },
      ),
    ),
  );

  emitThreadReopened(threads);
  return threads.length;
}

function invalidateListingCaches(category, id) {
  try {
    const ListingCache = require('./listingcache.service');
    const { responseCache } = require('./memorycache.service');
    void Promise.all([
      ListingCache.invalidateListCaches(category),
      ListingCache.invalidateListingCache(category, id),
    ]).catch((err) => {
      logger.error('[listing-thread-lifecycle] cache invalidation', {
        error: err.message,
      });
    });
    responseCache.clear();
  } catch {
    // optional
  }
}

module.exports = {
  closeThreadsForListing,
  reopenThreadsForListing,
  invalidateListingCaches,
};
