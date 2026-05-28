'use strict';
/**
 * ── Chat Message Queue Consumer ───────────────────────────────────────────────
 * Processes events from the CHAT_MESSAGES queue.
 *
 * Handled types:
 *  - message_persisted   : send push notification + update unread count in Redis
 *  - messages_read       : clear unread count for reader in Redis
 *  - conversation_created: push notification to new participant
 *  - attachment_process  : resize image, upload to S3, update message document
 *
 * Idempotency:
 *  Each processed _messageId is recorded in Redis (key: mq:chat:done:{id})
 *  with a 24-hour TTL. Duplicate deliveries (e.g. after NACK + retry) are
 *  detected and silently skipped.
 */
const { consume, QUEUES }            = require('../rabbitmq');
const { logger }                     = require('../../utils/logger');

// ── Lazy require helpers (avoid circular dependencies at boot) ─────────────────
const getRedis         = () => require('../../config/redis');
const getSocket        = () => { try { return require('../../config/socket').getIO(); } catch { return null; } };
const getNotifModel    = () => { const m = require('mongoose'); return m.models.Notification || m.model('Notification', new m.Schema({}, { strict: false })); };

const IDEMPOTENCY_TTL_S = 86_400; // 24 hours
const UNREAD_KEY_PREFIX  = 'chat:unread:';   // chat:unread:{userId}:{conversationId}

// ── Idempotency guard ─────────────────────────────────────────────────────────
const isDuplicate = async (messageId) => {
  if (!messageId) return false;
  try {
    const redis = getRedis();
    const key   = `mq:chat:done:${messageId}`;
    // SET NX: only set if key does not exist; returns 'OK' or null
    const result = await redis.set(key, '1', { NX: true, EX: IDEMPOTENCY_TTL_S });
    if (result === null) {
      // Key already existed → duplicate
      logger.debug('[ChatConsumer] Duplicate message skipped', { messageId });
      return true;
    }
    return false;
  } catch {
    return false; // Redis unavailable — allow processing (idempotency best-effort)
  }
};

// ── Handler: message_persisted ────────────────────────────────────────────────
const handleMessagePersisted = async (payload) => {
  const { messageId, conversationId, senderId, recipientId, senderName, preview, attachmentUrl } = payload;

  // 1. Increment unread count in Redis (atomic)
  const unreadKey = `${UNREAD_KEY_PREFIX}${recipientId}:${conversationId}`;
  try {
    const redis = getRedis();
    await redis.incr(unreadKey);
    await redis.expire(unreadKey, 7 * 86_400); // 7-day TTL
  } catch { /* Non-fatal */ }

  // 2. Push Socket.IO event to recipient's room for live unread badge update
  try {
    const io = getSocket();
    if (io) {
      const redis = getRedis();
      const unreadCount = parseInt(await redis.get(unreadKey) || '1', 10);

      io.to(`user:${recipientId}`).emit('conversation:unread_update', {
        conversationId,
        unreadCount,
        lastMessage: {
          preview:       preview || (attachmentUrl ? '📎 Attachment' : ''),
          senderId,
          senderName,
          messageId,
          createdAt:     new Date(),
        },
      });
    }
  } catch { /* Non-fatal */ }

  // 3. Persist in-app notification via mongoose (if the sender is not the recipient)
  if (senderId !== recipientId) {
    try {
      const mongoose = require('mongoose');
      const Notification = mongoose.models.Notification;
      if (Notification) {
        const notification = await Notification.create({
          recipient:  recipientId,
          sender:     senderId,
          type:       'message',
          message:    preview || 'You have a new message',
          metadata:   { conversationId, messageId, preview: preview || '' },
        });

        // Emit notification badge
        const io = getSocket();
        if (io && notification) {
          io.to(`user:${recipientId}`).emit('notification:new', {
            _id:       notification._id,
            type:      'message',
            message:   preview || 'You have a new message',
            sender:    senderId,
            senderName,
            metadata:  { conversationId, messageId },
            createdAt: notification.createdAt,
          });
        }
      }
    } catch (err) {
      logger.error('[ChatConsumer] Failed to create notification', { error: err.message });
    }
  }

  logger.debug('[ChatConsumer] message_persisted handled', { messageId, recipientId });
};

// ── Handler: messages_read ────────────────────────────────────────────────────
const handleMessagesRead = async (payload) => {
  const { conversationId, readerId } = payload;

  // Clear Redis unread counter
  try {
    const redis  = getRedis();
    const key    = `${UNREAD_KEY_PREFIX}${readerId}:${conversationId}`;
    await redis.del(key);
  } catch { /* Non-fatal */ }

  // Notify senders that their messages have been read (seen ticks)
  try {
    const io = getSocket();
    if (io) {
      io.to(`conversation:${conversationId}`).emit('messages:read', {
        conversationId,
        readerId,
        timestamp: Date.now(),
      });
    }
  } catch { /* Non-fatal */ }

  logger.debug('[ChatConsumer] messages_read handled', { conversationId, readerId });
};

// ── Handler: conversation_created ────────────────────────────────────────────
const handleConversationCreated = async (payload) => {
  const { conversationId, initiatorId, initiatorName, participantId, listingTitle } = payload;

  // Create in-app notification for the participant
  try {
    const mongoose    = require('mongoose');
    const Notification = mongoose.models.Notification;
    if (Notification) {
      const message = listingTitle
        ? `${initiatorName} started a conversation about "${listingTitle}"`
        : `${initiatorName} sent you a message`;

      const notification = await Notification.create({
        recipient:  participantId,
        sender:     initiatorId,
        type:       'message',
        message,
        metadata:   { conversationId, listingTitle: listingTitle || '' },
      });

      const io = getSocket();
      if (io && notification) {
        io.to(`user:${participantId}`).emit('notification:new', {
          _id:       notification._id,
          type:      'message',
          message,
          sender:    initiatorId,
          senderName:initiatorName,
          metadata:  { conversationId },
          createdAt: notification.createdAt,
        });
      }
    }
  } catch (err) {
    logger.error('[ChatConsumer] Failed to handle conversation_created', { error: err.message });
  }
};

// ── Handler: attachment_process ───────────────────────────────────────────────
const handleAttachmentProcess = async (payload) => {
  const { messageId, conversationId, senderId, tempPath, mimeType } = payload;

  if (!tempPath || !mimeType) {
    logger.warn('[ChatConsumer] attachment_process missing tempPath/mimeType', { messageId });
    return;
  }

  try {
    const S3Service = require('../../services/s3.service');
    const mongoose  = require('mongoose');
    const fs        = require('fs');
    const Message   = mongoose.models.Message;

    if (!Message) {
      logger.warn('[ChatConsumer] Message model not found — skipping attachment_process');
      return;
    }

    // Upload original to S3
    let fileBuffer;
    if (fs.existsSync(tempPath)) {
      fileBuffer = fs.readFileSync(tempPath);
    } else {
      logger.warn('[ChatConsumer] Temp file not found', { tempPath, messageId });
      return;
    }

    const s3Url = await S3Service.uploadBuffer({
      buffer:      fileBuffer,
      mimeType,
      folder:      `chat/${conversationId}`,
      filename:    `${messageId}-${Date.now()}`,
    });

    // Update the message document with the final S3 URL
    await Message.findByIdAndUpdate(messageId, {
      $set: { 'attachment.url': s3Url, 'attachment.processed': true },
    });

    // Notify conversation room of attachment ready
    const io = getSocket();
    if (io) {
      io.to(`conversation:${conversationId}`).emit('message:attachment_ready', {
        messageId,
        conversationId,
        attachmentUrl: s3Url,
      });
    }

    // Clean up temp file
    fs.unlink(tempPath, () => {});
    logger.info('[ChatConsumer] Attachment processed', { messageId, s3Url });
  } catch (err) {
    logger.error('[ChatConsumer] handleAttachmentProcess error', { error: err.message, messageId });
    throw err; // Let consumer retry
  }
};

// ── Main Dispatcher ───────────────────────────────────────────────────────────
const dispatch = async (payload) => {
  const { type, _messageId } = payload;

  // Idempotency check — skip duplicate deliveries
  if (await isDuplicate(_messageId)) return;

  switch (type) {
    case 'message_persisted':
      await handleMessagePersisted(payload);
      break;

    case 'messages_read':
      await handleMessagesRead(payload);
      break;

    case 'conversation_created':
      await handleConversationCreated(payload);
      break;

    case 'attachment_process':
      await handleAttachmentProcess(payload);
      break;

    default:
      logger.warn('[ChatConsumer] Unknown type', { type });
  }
};

// ── Start Consumer ────────────────────────────────────────────────────────────
const startChatConsumer = async () => {
  // Priority 9 queue — high throughput, allow retries for notification delivery
  await consume(QUEUES.CHAT_MESSAGES.name, dispatch, { maxRetries: 5 });
  logger.info('[ChatConsumer] ✅ Chat message consumer started');
};

module.exports = { startChatConsumer, dispatch };
