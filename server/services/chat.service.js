'use strict';
/**
 * chat.service.js — Business logic for the marketplace chat system.
 *
 * Design principles:
 *  - ONE conversation per buyer–seller pair.
 *  - Each product the pair discusses becomes a ProductThread inside that conversation.
 *  - Messages always belong to a ProductThread.
 *  - The service layer owns all DB writes; the controller is thin (validate → call → respond).
 */

const mongoose = require('mongoose');
const Conversation  = require('../models/conversation.model');
const ProductThread = require('../models/product-thread.model');
const Message       = require('../models/message.model');
const User          = require('../models/user.model');
const { encrypt, decrypt, isEncryptionEnabled } = require('./encryption.service');
const s3Service = require('./s3.service');
const { logger } = require('../utils/logger');

// ── Helpers ───────────────────────────────────────────────────────────────────
const safeDecrypt = (v) => { try { return decrypt(v || ''); } catch { return v || ''; } };

const resolveProfileImageUrl = (u) => {
  const raw = u?.profileImage || u?.googleProfileImage || u?.avatar || null;
  return s3Service.toProxyUrl(raw) || null;
};

const formatUser = (u) => {
  if (!u) return null;
  if (typeof u === 'string') {
    return { id: String(u), name: 'User', profileImageUrl: null };
  }
  return {
    id:              String(u._id ?? u.id),
    name:            u.name,
    profileImageUrl: resolveProfileImageUrl(u),
    provider:        u.provider,
  };
};

const orderedIds = (a, b) => {
  const s = [String(a), String(b)].sort();
  return s;
};

const buildPreview = (plainContent, attachments = []) => {
  if (plainContent) return plainContent.slice(0, 80);
  if (!attachments.length) return '';
  return attachments.length === 1
    ? `📎 ${attachments[0]?.name || attachments[0]?.type || 'Attachment'}`
    : `📎 ${attachments.length} attachments`;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the single conversation for a buyer–seller pair, creating it if needed.
 * Never creates a second conversation for the same pair.
 */
exports.getOrCreateConversation = async (userId, recipientId) => {
  const [p1, p2] = orderedIds(userId, recipientId);
  const participantFilter = { participants: { $all: [p1, p2], $size: 2 } };
  const populateOpts = [
    { path: 'participants', select: 'name profileImage googleProfileImage avatar provider' },
    { path: 'lastMessage', select: 'content attachments sender createdAt productThread' },
  ];

  const loadConversation = (query) =>
    Conversation.findOne(query).populate(populateOpts);

  // Cannot upsert with `participants` in both query and $setOnInsert — MongoDB error:
  // "cannot interpret query fields to set, path 'participants' is matched twice"
  let conversation = await loadConversation(participantFilter);

  if (!conversation) {
    try {
      conversation = await Conversation.create({
        participants: [p1, p2],
        unreadCounts: new Map([[p1, 0], [p2, 0]]),
        threadCount: 0,
        activeThreadCount: 0,
      });
      conversation = await loadConversation({ _id: conversation._id });
    } catch (err) {
      if (err?.code === 11000) {
        conversation = await loadConversation(participantFilter);
      } else {
        throw err;
      }
    }
  }

  return conversation;
};

/**
 * Format a conversation document for API response.
 */
exports.formatConversation = (conv, viewerUserId) => {
  const lastMsg = conv.lastMessage;
  return {
    _id:              conv._id,
    participants:     conv.participants.map ? conv.participants.map(formatUser) : [],
    listing:          conv.listing || null,         // last-active product context for inbox card
    threadCount:      conv.threadCount || 0,
    activeThreadCount: conv.activeThreadCount || 0,
    lastMessage:      lastMsg ? {
      _id:         lastMsg._id,
      content:     buildPreview(safeDecrypt(lastMsg.content || ''), lastMsg.attachments || []),
      sender:      String(lastMsg.sender),
      attachments: lastMsg.attachments || [],
      productThread: lastMsg.productThread || null,
      createdAt:   lastMsg.createdAt,
    } : null,
    unreadCount:  conv.unreadCounts?.get
      ? (conv.unreadCounts.get(viewerUserId) || 0)
      : (conv.unreadCounts?.[viewerUserId] || 0),
    updatedAt: conv.updatedAt,
    createdAt: conv.createdAt,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT THREADS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the ProductThread for a given conversation+product, creating it if needed.
 * sellerId is the listing owner; buyerId is the initiating user.
 */
exports.getOrCreateProductThread = async ({
  conversationId,
  productId,
  productType,
  productTitle,
  productPrice,
  productImage,
  currency,
  sellerId,
  buyerId,
}) => {
  let thread = await ProductThread.findOneAndUpdate(
    { conversation: conversationId, 'product.productId': productId },
    {
      $setOnInsert: {
        conversation: conversationId,
        seller:    sellerId,
        buyer:     buyerId,
        status:    'active',
        startedAt: new Date(),
        unreadCounts: new Map([[String(sellerId), 0], [String(buyerId), 0]]),
      },
      // Refresh product snapshot on every open (use dotted paths only — never mix with whole `product` object)
      $set: {
        'product.productId':   productId,
        'product.productType': productType,
        'product.title':       productTitle || null,
        'product.price':       productPrice != null ? Number(productPrice) : null,
        'product.image':       productImage || null,
        'product.currency':    currency || '₹',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // Repair legacy threads that were created with the wrong buyer role.
  if (
    thread &&
    String(thread.seller) === String(sellerId) &&
    String(thread.buyer) !== String(buyerId)
  ) {
    thread.buyer = buyerId;
    thread.unreadCounts = thread.unreadCounts || new Map();
    thread.unreadCounts.set(String(buyerId), thread.unreadCounts.get(String(buyerId)) || 0);
    await thread.save();
  }

  // Update conversation thread counters when a new thread was created
  // ($inc is idempotent — if thread already existed, findOneAndUpdate won't $setOnInsert)
  const wasNew = thread.messageCount === 0 && !thread.closedAt;
  if (wasNew) {
    await Conversation.updateOne(
      { _id: conversationId },
      {
        $inc: { threadCount: 1, activeThreadCount: 1 },
        $set: {
          'listing.listingId':    productId,
          'listing.listingType':  productType,
          'listing.listingTitle': productTitle || null,
          'listing.listingPrice': productPrice != null ? Number(productPrice) : null,
          'listing.listingImage': productImage || null,
          'listing.currency':     currency || '₹',
        },
      },
    );
  }

  return thread;
};

/**
 * Get all threads in a conversation, newest-active first.
 */
exports.getThreads = async (conversationId, userId, { statusFilter } = {}) => {
  const query = { conversation: conversationId };
  if (statusFilter === 'active') query.status = 'active';
  if (statusFilter === 'sold')   query.status = { $in: ['sold', 'closed'] };

  return ProductThread.find(query)
    .sort({ lastMessageAt: -1 })
    .populate('seller', 'name profileImage googleProfileImage avatar provider')
    .populate('buyer',  'name profileImage googleProfileImage avatar provider')
    .lean()
    .then((threads) =>
      threads.map((thread) => ({
        ...thread,
        seller: formatUser(thread.seller),
        buyer:  formatUser(thread.buyer),
      })),
    );
};

/**
 * Close a thread when a product is marked as sold.
 * Only the seller (or admin) can close a thread.
 */
exports.closeThread = async (threadId, userId, reason = 'sold') => {
  const thread = await ProductThread.findById(threadId);
  if (!thread) throw Object.assign(new Error('Thread not found'), { statusCode: 404 });
  if (String(thread.seller) !== String(userId)) {
    throw Object.assign(new Error('Only the seller can close a thread'), { statusCode: 403 });
  }
  if (thread.status !== 'active') {
    throw Object.assign(new Error('Thread is already closed'), { statusCode: 409 });
  }

  thread.status       = reason === 'sold' ? 'sold' : 'closed';
  thread.closedReason = reason;
  thread.closedAt     = new Date();
  await thread.save();

  // Update conversation counter
  await Conversation.updateOne(
    { _id: thread.conversation },
    { $inc: { activeThreadCount: -1 } },
  );

  // Inject a system message into the thread
  const systemMsg = await Message.create({
    conversation: thread.conversation,
    productThread: thread._id,
    sender:      userId,
    content:     reason === 'sold' ? 'Product marked as sold. Conversation closed.' : 'Conversation closed.',
    messageType: 'system',
    readBy:      [userId],
    status:      'sent',
  });
  await Conversation.updateOne({ _id: thread.conversation }, { $set: { lastMessage: systemMsg._id } });

  return thread;
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_ATTACHMENT_TYPES = ['image', 'video', 'audio', 'document', 'other'];

const normalizeAttachments = (attachments = []) => {
  if (!Array.isArray(attachments)) return [];
  return attachments.slice(0, 5).map((a) => {
    const url = String(a?.url || '').trim();
    if (!url || !url.startsWith('/api/images/chats/')) return null;
    const mimeType = String(a?.mimeType || '').trim();
    return {
      name:     String(a?.name || 'Attachment').trim().slice(0, 255),
      url,
      key:      String(a?.key || '').trim(),
      mimeType,
      size:     Number(a?.size) || 0,
      type:     ALLOWED_ATTACHMENT_TYPES.includes(a?.type) ? a.type : 'other',
    };
  }).filter(Boolean);
};

/**
 * Send a message inside a product thread.
 */
exports.sendMessage = async ({
  conversationId,
  threadId,
  senderId,
  content,
  attachments,
  replyTo,
}) => {
  const plainContent    = String(content || '').trim();
  const safeAttachments = normalizeAttachments(attachments);

  if (!plainContent && safeAttachments.length === 0) {
    throw Object.assign(new Error('Message content or attachment required'), { statusCode: 400 });
  }
  if (plainContent.length > 5000) {
    throw Object.assign(new Error('Message exceeds 5000 characters'), { statusCode: 400 });
  }

  // Verify conversation membership
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: senderId,
  });
  if (!conversation) {
    throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
  }

  // Verify thread belongs to conversation
  const thread = await ProductThread.findOne({ _id: threadId, conversation: conversationId });
  if (!thread) {
    throw Object.assign(new Error('Product thread not found'), { statusCode: 404 });
  }
  if (thread.status !== 'active') {
    throw Object.assign(new Error('This product thread is closed'), { statusCode: 409 });
  }

  // Validate replyTo
  let replyToId = null;
  if (replyTo && mongoose.Types.ObjectId.isValid(replyTo)) {
    const parent = await Message.findOne({
      _id: replyTo,
      conversation: conversationId,
    }).select('_id').lean();
    if (parent) replyToId = parent._id;
  }

  // Save message (encrypted)
  const encryptedContent = encrypt(plainContent);
  let message = await Message.create({
    conversation:  conversationId,
    productThread: threadId,
    sender:        senderId,
    content:       encryptedContent,
    attachments:   safeAttachments,
    replyTo:       replyToId,
    messageType:   safeAttachments.length > 0 && !plainContent ? 'image' : 'text',
    readBy:        [senderId],
    status:        'sent',
  });

  // Atomically update unread counts (all participants except sender)
  const incUpdate = {};
  for (const pid of conversation.participants) {
    const pidStr = String(pid);
    if (pidStr !== String(senderId)) {
      incUpdate[`unreadCounts.${pidStr}`] = 1;
    }
  }

  const threadIncUpdate = {};
  const threadUnreadKey = `unreadCounts.${String(
    conversation.participants.find((p) => String(p) !== String(senderId)) || '',
  )}`;
  threadIncUpdate[threadUnreadKey] = 1;

  await Promise.all([
    Conversation.updateOne(
      { _id: conversationId },
      {
        $set: { lastMessage: message._id },
        $inc: incUpdate,
      },
    ),
    ProductThread.updateOne(
      { _id: threadId },
      {
        $set: { lastMessageAt: message.createdAt },
        $inc: { messageCount: 1, [threadUnreadKey]: 1 },
      },
    ),
  ]);

  // Populate for response
  message = await Message.findById(message._id)
    .populate('sender', 'name profileImage googleProfileImage avatar provider')
    .populate({
      path: 'replyTo',
      select: 'content sender attachments createdAt',
      populate: { path: 'sender', select: 'name profileImage googleProfileImage avatar' },
    })
    .lean();

  return { message, plainContent, conversation, thread };
};

/**
 * Format a message document for API/socket response (always decrypts).
 */
exports.formatMessage = (m, viewerUserId) => {
  const isDeleted = m.deletedForEveryone;
  return {
    _id:              m._id,
    conversation:     m.conversation,
    productThread:    m.productThread || null,
    sender:           formatUser(m.sender),
    content:          isDeleted ? 'This message was deleted' : safeDecrypt(m.content || ''),
    attachments:      isDeleted ? [] : (m.attachments || []),
    deletedForEveryone: !!isDeleted,
    messageType:      m.messageType || 'text',
    offerData:        m.offerData || null,
    status:           m.status || 'sent',
    deliveredTo:      (m.deliveredTo || []).map(String),
    readBy:           (m.readBy || []).map(String),
    replyTo:          m.replyTo ? {
      _id:         m.replyTo._id,
      sender:      formatUser(m.replyTo.sender),
      content:     safeDecrypt(m.replyTo.content || ''),
      attachments: m.replyTo.attachments || [],
      createdAt:   m.replyTo.createdAt,
    } : null,
    reactions:   m.reactions || [],
    createdAt:   m.createdAt,
  };
};

/**
 * Paginated messages for a thread (or whole conversation).
 */
exports.getMessages = async ({ conversationId, threadId, userId, page, limit }) => {
  page  = Math.max(page || 1, 1);
  limit = Math.min(Math.max(limit || 50, 1), 100);

  const filter = {
    conversation: conversationId,
    deletedFor:   { $ne: userId },
    ...(threadId ? { productThread: threadId } : {}),
  };

  const [messages, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('sender', 'name profileImage googleProfileImage avatar provider')
      .populate({
        path: 'replyTo',
        select: 'content sender attachments createdAt',
        populate: { path: 'sender', select: 'name profileImage googleProfileImage avatar' },
      })
      .lean(),
    Message.countDocuments(filter),
  ]);

  return {
    messages: messages.reverse(), // chronological
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit), hasMore: page * limit < total },
  };
};

/**
 * Full-text search within a conversation.
 */
exports.searchMessages = async ({ conversationId, userId, query, threadId, page, limit }) => {
  page  = Math.max(page || 1, 1);
  limit = Math.min(Math.max(limit || 30, 1), 50);

  if (!query || query.trim().length < 2) {
    throw Object.assign(new Error('Search query must be at least 2 characters'), { statusCode: 400 });
  }

  const filter = {
    conversation:       conversationId,
    deletedFor:         { $ne: userId },
    deletedForEveryone: { $ne: true },
    ...(threadId ? { productThread: threadId } : {}),
  };

  // Content is encrypted; we do regex on the raw cipher text (works for short
  // plaintext when encryption is off or for system messages)
  if (!isEncryptionEnabled()) {
    filter.content = { $regex: query.trim(), $options: 'i' };
  } else {
    // Fallback: search unencrypted fields (system messages, offer labels)
    filter.$or = [
      { messageType: { $in: ['system', 'offer'] } },
    ];
  }

  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('sender', 'name profileImage googleProfileImage avatar provider')
    .lean();

  return messages.reverse();
};

// ─────────────────────────────────────────────────────────────────────────────
// OFFERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Buyer makes an offer on a product thread.
 */
exports.makeOffer = async ({ threadId, buyerId, amount, currency = '₹' }) => {
  const thread = await ProductThread.findById(threadId);
  if (!thread) throw Object.assign(new Error('Thread not found'), { statusCode: 404 });
  if (String(thread.buyer) !== String(buyerId)) {
    if (String(thread.seller) === String(buyerId)) {
      throw Object.assign(new Error('Only the buyer can make an offer'), { statusCode: 403 });
    }
    // Repair legacy threads created with seller/buyer reversed.
    thread.buyer = buyerId;
    thread.unreadCounts = thread.unreadCounts || new Map();
    thread.unreadCounts.set(String(buyerId), thread.unreadCounts.get(String(buyerId)) || 0);
    await thread.save();
  }
  if (thread.status !== 'active') {
    throw Object.assign(new Error('Thread is closed'), { statusCode: 409 });
  }
  if (!amount || amount <= 0) {
    throw Object.assign(new Error('Offer amount must be positive'), { statusCode: 400 });
  }

  const listedPrice = Math.round(Number(thread.product?.price) || 0);
  const amountInt = Math.round(Number(amount));
  if (listedPrice > 0) {
    const minOffer = Math.floor(listedPrice * 0.8);
    const maxOffer = Math.ceil(listedPrice * 1.2);
    if (amountInt < minOffer) {
      throw Object.assign(
        new Error(`Amount is too low. Offer must be between ${minOffer.toLocaleString('en-IN')} and ${maxOffer.toLocaleString('en-IN')}.`),
        { statusCode: 400 },
      );
    }
    if (amountInt > maxOffer) {
      throw Object.assign(
        new Error(`Amount is too high. Offer must be between ${minOffer.toLocaleString('en-IN')} and ${maxOffer.toLocaleString('en-IN')}.`),
        { statusCode: 400 },
      );
    }
  }

  // Update thread offer state
  thread.offerStatus  = 'pending';
  thread.activeOffer  = { amount, currency, offeredBy: buyerId, offeredAt: new Date() };
  await thread.save();

  // Create an offer message
  const buyer = await User.findById(buyerId).select('name').lean();
  const label = `${buyer?.name || 'Buyer'} offered ${currency}${amount.toLocaleString('en-IN')}`;

  const message = await Message.create({
    conversation:  thread.conversation,
    productThread: thread._id,
    sender:        buyerId,
    content:       encrypt(label),
    messageType:   'offer',
    offerData:     { amount, currency, status: 'pending' },
    readBy:        [buyerId],
    status:        'sent',
  });

  await Conversation.updateOne(
    { _id: thread.conversation },
    { $set: { lastMessage: message._id } },
  );

  return { thread, message, plainLabel: label };
};

/**
 * Seller responds to an offer (accept or decline).
 */
exports.respondToOffer = async ({ threadId, sellerId, accept }) => {
  const thread = await ProductThread.findById(threadId);
  if (!thread) throw Object.assign(new Error('Thread not found'), { statusCode: 404 });
  if (String(thread.seller) !== String(sellerId)) {
    throw Object.assign(new Error('Only the seller can respond to an offer'), { statusCode: 403 });
  }
  if (thread.offerStatus !== 'pending') {
    throw Object.assign(new Error('No pending offer on this thread'), { statusCode: 409 });
  }

  const newStatus       = accept ? 'accepted' : 'declined';
  thread.offerStatus    = newStatus;
  if (!accept) thread.activeOffer = { amount: null, currency: '₹', offeredBy: null, offeredAt: null };
  await thread.save();

  const seller = await User.findById(sellerId).select('name').lean();
  const label  = accept
    ? `${seller?.name || 'Seller'} accepted the offer`
    : `${seller?.name || 'Seller'} declined the offer`;

  const message = await Message.create({
    conversation:  thread.conversation,
    productThread: thread._id,
    sender:        sellerId,
    content:       encrypt(label),
    messageType:   'offer',
    offerData:     {
      amount:   thread.activeOffer?.amount || null,
      currency: thread.activeOffer?.currency || '₹',
      status:   newStatus,
    },
    readBy:  [sellerId],
    status:  'sent',
  });

  await Conversation.updateOne(
    { _id: thread.conversation },
    { $set: { lastMessage: message._id } },
  );

  return { thread, message, plainLabel: label, accepted: accept };
};

// ─────────────────────────────────────────────────────────────────────────────
// MARK AS READ
// ─────────────────────────────────────────────────────────────────────────────

exports.markThreadRead = async (conversationId, threadId, userId) => {
  const [, threadUpdate] = await Promise.all([
    // Clear conversation-level unread
    Conversation.updateOne(
      { _id: conversationId, participants: userId },
      { $set: { [`unreadCounts.${userId}`]: 0 } },
    ),
    // Clear thread-level unread
    ProductThread.updateOne(
      { _id: threadId, conversation: conversationId },
      { $set: { [`unreadCounts.${userId}`]: 0 } },
    ),
    // Mark all unread messages in thread as read
    Message.updateMany(
      {
        productThread: threadId,
        conversation:  conversationId,
        readBy:        { $ne: userId },
        sender:        { $ne: userId },
      },
      { $addToSet: { readBy: userId }, $set: { status: 'read' } },
    ),
  ]);
  return threadUpdate;
};

exports.markConversationRead = async (conversationId, userId) => {
  await Promise.all([
    Conversation.updateOne(
      { _id: conversationId, participants: userId },
      { $set: { [`unreadCounts.${userId}`]: 0 } },
    ),
    ProductThread.updateMany(
      { conversation: conversationId },
      { $set: { [`unreadCounts.${userId}`]: 0 } },
    ),
    Message.updateMany(
      {
        conversation: conversationId,
        readBy:       { $ne: userId },
        sender:       { $ne: userId },
      },
      { $addToSet: { readBy: userId }, $set: { status: 'read' } },
    ),
  ]);
};
