'use strict';
/**
 * ── Chat Message Queue Producer ───────────────────────────────────────────────
 * Publishes chat-related tasks to the CHAT_MESSAGES queue.
 *
 * Events published:
 *  - message_persisted   : after saving a message to DB; triggers notification + cache bust
 *  - message_read        : user read a batch of messages; triggers unread-count update
 *  - conversation_created: new conversation; triggers push notification to recipient
 *  - attachment_process  : image/file sent in chat; triggers S3 upload + thumbnail
 *
 * All publishes are non-blocking with in-process fallback — the HTTP response
 * is not held up if RabbitMQ is unavailable.
 */
const { publish, QUEUES } = require('../rabbitmq');
const { logger }          = require('../../utils/logger');

const QUEUE = QUEUES.CHAT_MESSAGES.name;

// ── 1. Message Persisted ──────────────────────────────────────────────────────
/**
 * Notify downstream consumers that a new message was saved to MongoDB.
 * Consumers will: increment unread count, push FCM notification, emit socket event.
 *
 * @param {object} p
 * @param {string} p.messageId        - saved Message._id (string)
 * @param {string} p.conversationId
 * @param {string} p.senderId
 * @param {string} p.recipientId
 * @param {string} p.senderName
 * @param {string} p.preview           - short decrypted text preview (≤ 80 chars)
 * @param {string} [p.attachmentUrl]   - present if message has an image/file
 * @param {number} [p.timestamp]       - ms epoch; defaults to now
 */
const publishMessagePersisted = async ({
  messageId,
  conversationId,
  senderId,
  recipientId,
  senderName,
  preview,
  attachmentUrl,
  timestamp,
}) => {
  try {
    const queued = await publish(QUEUE, {
      type:           'message_persisted',
      messageId,
      conversationId,
      senderId,
      recipientId,
      senderName,
      preview:        (preview || '').slice(0, 80),
      attachmentUrl:  attachmentUrl || null,
      timestamp:      timestamp || Date.now(),
    });

    if (!queued) {
      // In-process fallback — log warning; notification.controller handles direct fallback
      logger.warn('[ChatProducer] Queue unavailable — message_persisted event dropped (notifications may be delayed)', {
        messageId, conversationId,
      });
    }
  } catch (err) {
    logger.error('[ChatProducer] publishMessagePersisted error', { error: err.message });
  }
};

// ── 2. Messages Read ──────────────────────────────────────────────────────────
/**
 * Mark a batch of messages as read and decrement unread counts.
 *
 * @param {object} p
 * @param {string}   p.conversationId
 * @param {string}   p.readerId        - user who read the messages
 * @param {string[]} p.messageIds      - array of Message._id strings
 */
const publishMessagesRead = async ({ conversationId, readerId, messageIds }) => {
  try {
    if (!messageIds || messageIds.length === 0) return;

    await publish(QUEUE, {
      type:           'messages_read',
      conversationId,
      readerId,
      messageIds,
      timestamp:      Date.now(),
    });
  } catch (err) {
    logger.error('[ChatProducer] publishMessagesRead error', { error: err.message });
  }
};

// ── 3. Conversation Created ───────────────────────────────────────────────────
/**
 * New conversation started — notify the other participant.
 *
 * @param {object} p
 * @param {string} p.conversationId
 * @param {string} p.initiatorId
 * @param {string} p.initiatorName
 * @param {string} p.participantId     - the OTHER person
 * @param {string} [p.listingTitle]    - listing that prompted the chat
 * @param {string} [p.listingImage]
 */
const publishConversationCreated = async ({
  conversationId,
  initiatorId,
  initiatorName,
  participantId,
  listingTitle,
  listingImage,
}) => {
  try {
    await publish(QUEUE, {
      type:          'conversation_created',
      conversationId,
      initiatorId,
      initiatorName,
      participantId,
      listingTitle:  listingTitle || null,
      listingImage:  listingImage || null,
      timestamp:     Date.now(),
    });
  } catch (err) {
    logger.error('[ChatProducer] publishConversationCreated error', { error: err.message });
  }
};

// ── 4. Attachment Processing ──────────────────────────────────────────────────
/**
 * A chat message contains a raw image/file that needs async processing
 * (resize thumbnails, upload to S3, update message with final URL).
 *
 * @param {object} p
 * @param {string} p.messageId
 * @param {string} p.conversationId
 * @param {string} p.senderId
 * @param {string} p.tempPath       - local temp file path
 * @param {string} p.mimeType       - e.g. 'image/jpeg'
 * @param {number} [p.sizeBytes]
 */
const publishAttachmentProcess = async ({
  messageId,
  conversationId,
  senderId,
  tempPath,
  mimeType,
  sizeBytes,
}) => {
  try {
    await publish(QUEUE, {
      type:           'attachment_process',
      messageId,
      conversationId,
      senderId,
      tempPath,
      mimeType,
      sizeBytes:      sizeBytes || 0,
      timestamp:      Date.now(),
    });
  } catch (err) {
    logger.error('[ChatProducer] publishAttachmentProcess error', { error: err.message });
  }
};

module.exports = {
  publishMessagePersisted,
  publishMessagesRead,
  publishConversationCreated,
  publishAttachmentProcess,
};
