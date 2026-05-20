const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const User = require("../models/user.model");
const mongoose = require("mongoose");
const { getIO } = require("../config/socket");
const { createNotification } = require("./notification.controller");
const { logger } = require("../utils/logger");
const { encrypt, decrypt, isEncryptionEnabled } = require("../services/encryption.service");
const s3Service = require("../services/s3.service");

// ── RabbitMQ Producers ─────────────────────────────────────────────────────────
const {
  publishChatNotification,
  publishOfferEmail,
  publishNotification,
} = require('../queues/producers/notification.producer');

const MAX_ATTACHMENTS_PER_MESSAGE = 5;
const MAX_MESSAGE_LENGTH = 5000;

/** Quick ObjectId format check — returns true when valid. */
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const getAttachmentType = (mimeType = "") => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("word") ||
    mimeType.includes("excel") ||
    mimeType.includes("sheet") ||
    mimeType.includes("powerpoint") ||
    mimeType.includes("text") ||
    mimeType.includes("csv") ||
    mimeType.includes("zip")
  ) {
    return "document";
  }
  return "other";
};

const normalizeAttachments = (attachments = []) => {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
    .map((a) => {
      const mimeType = String(a?.mimeType || "").trim();
      const url = String(a?.url || "").trim();
      if (!url || !url.startsWith('/api/images/chats/')) return null;

      return {
        name: String(a?.name || "Attachment").trim().slice(0, 255),
        url,
        key: String(a?.key || "").trim(),
        mimeType,
        size: Number(a?.size) || 0,
        type: a?.type || getAttachmentType(mimeType),
      };
    })
    .filter(Boolean);
};

const buildMessagePreview = (plainContent, attachments = []) => {
  if (plainContent) return plainContent;
  if (!attachments.length) return "";

  if (attachments.length === 1) {
    const first = attachments[0];
    const label = first?.name || first?.type || 'Attachment';
    return `Attachment: ${label}`;
  }
  return `${attachments.length} attachments`;
};

const safeDecrypt = (value) => {
  try {
    return decrypt(value || "");
  } catch (_) {
    return value || "";
  }
};


// Helper: set no-cache headers on sensitive responses
const setNoCacheHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
};

const getOrderedParticipantIds = (a, b) => {
  const p1 = String(a);
  const p2 = String(b);
  return p1 < p2 ? [p1, p2] : [p2, p1];
};

const createAndEmitMessageNotification = async ({ recipientId, senderId, conversationId, senderName }) => {
  const message = `${senderName} sent you a message`;
  const notification = await createNotification({
    recipient: recipientId,
    sender: senderId,
    type: 'message',
    message,
    metadata: { conversationId },
  });

  if (notification) {
    try {
      const io = getIO();
      io.to(`user:${recipientId}`).emit('notification:new', {
        _id: notification._id,
        type: 'message',
        message,
        sender: { id: senderId, name: senderName },
        metadata: { conversationId: String(conversationId) },
        createdAt: notification.createdAt,
      });
    } catch (_) {}
  }

  return notification;
};
//helper: format conversation for response (decrypt lastMessage content)
// Helper: format user for response
const formatUser = (u) => {
  if (!u) return null;
  return {
    id: u._id,
    name: u.name,
    profileImageUrl: u.profileImage || u.googleProfileImage || u.avatar || null,
    provider: u.provider,
  };
};

// ==================== GET OR CREATE CONVERSATION ====================
// POST /api/chat/conversations
// Body: { recipientId, listingId?, listingType?, listingTitle?, listingPrice?, listingImage?, currency? }
exports.getOrCreateConversation = async (req, res) => {
  try {
    const senderId = req.user.id;
    const {
      recipientId,
      listingId,
      listingType,
      listingTitle,
      listingPrice,
      listingImage,
      currency,
    } = req.body;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: "recipientId is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({ success: false, message: "Invalid recipientId" });
    }
    if (recipientId === senderId) {
      return res.status(400).json({ success: false, message: "Cannot message yourself" });
    }
    if (listingId && !mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ success: false, message: "Invalid listingId" });
    }
    if (listingType && !listingId) {
      return res.status(400).json({ success: false, message: "listingId is required when listingType is provided" });
    }

    // Check recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient not found" });
    }

    // One conversation thread per user pair (reuse regardless of which listing opened chat)
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId], $size: 2 },
    })
      .sort({ updatedAt: -1 })
      .populate("participants", "name profileImage googleProfileImage avatar provider")
      .populate({
        path: "lastMessage",
        select: "content attachments sender createdAt",
      });

    if (conversation && listingId && listingType) {
      conversation.listing = {
        listingId,
        listingType,
        listingTitle: listingTitle ?? conversation.listing?.listingTitle ?? null,
        listingPrice:
          listingPrice != null ? Number(listingPrice) : conversation.listing?.listingPrice ?? null,
        listingImage: listingImage ?? conversation.listing?.listingImage ?? null,
        currency: currency || conversation.listing?.currency || "₹",
      };
      await conversation.save();
      conversation = await Conversation.findById(conversation._id)
        .populate("participants", "name profileImage googleProfileImage avatar provider")
        .populate({
          path: "lastMessage",
          select: "content attachments sender createdAt",
        });
    }

    if (!conversation) {
      const listingData = listingId
        ? {
            listingId,
            listingType,
            listingTitle,
            listingPrice: listingPrice != null ? Number(listingPrice) : null,
            listingImage: listingImage || null,
            currency: currency || "₹",
          }
        : {
            listingId: null,
            listingType: null,
            listingTitle: null,
            listingPrice: null,
            listingImage: null,
            currency: "₹",
          };
      const participants = getOrderedParticipantIds(senderId, recipientId);

      conversation = await Conversation.create({
        participants,
        listing: listingData,
        unreadCounts: new Map([[recipientId, 0], [senderId, 0]]),
      });

      conversation = await Conversation.findById(conversation._id)
        .populate("participants", "name profileImage googleProfileImage avatar provider")
        .populate({
          path: "lastMessage",
          select: "content attachments sender createdAt",
        });
    }

    // Format — decrypt lastMessage content if present
    const lastMsg = conversation.lastMessage;
    const formatted = {
      _id: conversation._id,
      participants: conversation.participants.map(formatUser),
      listing: conversation.listing,
      lastMessage: lastMsg
        ? {
            ...(lastMsg.toObject ? lastMsg.toObject() : lastMsg),
            attachments: lastMsg.attachments || [],
            content: buildMessagePreview(
              safeDecrypt(lastMsg.content || ""),
              lastMsg.attachments || [],
            ),
          }
        : null,
      unreadCount: conversation.unreadCounts?.get(senderId) || 0,
      updatedAt: conversation.updatedAt,
      createdAt: conversation.createdAt,
    };

    setNoCacheHeaders(res);
    res.status(200).json({ success: true, conversation: formatted, encrypted: isEncryptionEnabled() });
  } catch (error) {
    logger.error("Get/create conversation error", {
      error: error?.message || String(error),
      requestId: req.requestId,
      senderId: req.user?.id,
      recipientId: req.body?.recipientId,
      listingId: req.body?.listingId,
      listingType: req.body?.listingType,
    });
    res.status(500).json({ success: false, message: "Failed to get conversation" });
  }
};

// ==================== GET ALL CONVERSATIONS ====================
// GET /api/chat/conversations?page=1&limit=20
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const filter = { participants: userId };
    let conversations, total, pagination;

    if (page > 1) {
      conversations = await Conversation.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit + 1)
        .populate("participants", "name profileImage googleProfileImage avatar provider")
        .populate({ path: "lastMessage", select: "content attachments sender createdAt" })
        .lean();

      const hasMore = conversations.length > limit;
      if (hasMore) conversations = conversations.slice(0, limit);
      pagination = { page, limit, hasMore };
    } else {
      [conversations, total] = await Promise.all([
        Conversation.find(filter)
          .sort({ updatedAt: -1 })
          .limit(limit)
          .populate("participants", "name profileImage googleProfileImage avatar provider")
          .populate({ path: "lastMessage", select: "content attachments sender createdAt" })
          .lean(),
        Conversation.countDocuments(filter),
      ]);
      pagination = { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: limit < total };
    }

    const formatted = conversations.map((c) => ({
      _id: c._id,
      participants: c.participants.map(formatUser),
      listing: c.listing,
      lastMessage: c.lastMessage
        ? {
            ...c.lastMessage,
            attachments: c.lastMessage.attachments || [],
            content: buildMessagePreview(
              safeDecrypt(c.lastMessage.content || ""),
              c.lastMessage.attachments || [],
            ),
          }
        : null,
      unreadCount: c.unreadCounts?.[userId] || 0,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
    }));

    setNoCacheHeaders(res);
    res.status(200).json({ success: true, conversations: formatted, pagination, encrypted: isEncryptionEnabled() });
  } catch (error) {
    logger.error("Get conversations error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch conversations" });
  }
};

// ==================== GET MESSAGES IN A CONVERSATION ====================
// GET /api/chat/conversations/:conversationId/messages?page=1&limit=50
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    if (!isValidId(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid conversationId" });
    }
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
    const skip = (page - 1) * limit;

    // Verify user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const [messages, total] = await Promise.all([
      Message.find({ conversation: conversationId, deletedFor: { $ne: userId } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender", "name profileImage googleProfileImage avatar provider")
        .populate({
          path: "replyTo",
          select: "content sender attachments createdAt",
          populate: {
            path: "sender",
            select: "name profileImage googleProfileImage avatar provider",
          },
        })
        .lean(),
      Message.countDocuments({ conversation: conversationId, deletedFor: { $ne: userId } }),
    ]);

    const formatted = messages.map((m) => ({
      _id: m._id,
      sender: formatUser(m.sender),
      content: m.deletedForEveryone ? "This message was deleted" : safeDecrypt(m.content),
      attachments: m.deletedForEveryone ? [] : (m.attachments || []),
      deletedForEveryone: m.deletedForEveryone || false,
      status: m.status || 'sent',
      deliveredTo: m.deliveredTo?.map((id) => id.toString()) || [],
      readBy: m.readBy?.map((id) => id.toString()) || [],
      replyTo: m.replyTo
        ? {
            _id: m.replyTo._id,
            sender: formatUser(m.replyTo.sender),
            content: safeDecrypt(m.replyTo.content || ""),
            attachments: m.replyTo.attachments || [],
            createdAt: m.replyTo.createdAt,
          }
        : null,
      reactions: m.reactions || [],
      createdAt: m.createdAt,
    }));

    // Return in chronological order (oldest first)
    formatted.reverse();

    setNoCacheHeaders(res);
    res.status(200).json({
      success: true,
      messages: formatted,
      encrypted: isEncryptionEnabled(),
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    logger.error("Get messages error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch messages" });
  }
};

// ==================== SEND MESSAGE ====================
// POST /api/chat/conversations/:conversationId/messages
// Body: { content }
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    if (!isValidId(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid conversationId" });
    }
    const { content, attachments, replyTo } = req.body;

    const safeAttachments = normalizeAttachments(attachments);
    const plainContent = String(content || "").trim();

    if (!plainContent && safeAttachments.length === 0) {
      return res.status(400).json({ success: false, message: "Message content or attachment is required" });
    }
    if (plainContent.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, message: `Message content exceeds ${MAX_MESSAGE_LENGTH} characters` });
    }

    if (replyTo && !isValidId(replyTo)) {
      return res.status(400).json({ success: false, message: "Invalid replyTo message id" });
    }

    // Verify participation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    let replyToId = null;
    if (replyTo) {
      const parent = await Message.findOne({ _id: replyTo, conversation: conversationId }).select("_id").lean();
      if (!parent) {
        return res.status(400).json({ success: false, message: "Reply message not found in this conversation" });
      }
      replyToId = parent._id;
    }

    // Encrypt content before storing
    const encryptedContent = encrypt(plainContent);

    // Create message — stored ENCRYPTED in MongoDB
    let message = await Message.create({
      conversation: conversationId,
      sender: userId,
      content: encryptedContent,
      attachments: safeAttachments,
      replyTo: replyToId,
      readBy: [userId], // sender has read it
    });

    // Atomically update conversation (prevents lost-update race when
    // two messages arrive concurrently for the same conversation)
    const incUpdate = {};
    for (const pid of conversation.participants) {
      const pidStr = pid.toString();
      if (pidStr !== userId) {
        incUpdate[`unreadCounts.${pidStr}`] = 1;
      }
    }
    await Conversation.updateOne(
      { _id: conversationId },
      { $set: { lastMessage: message._id }, $inc: incUpdate },
    );

    // Populate sender
    message = await Message.findById(message._id)
      .populate("sender", "name profileImage googleProfileImage avatar provider")
      .lean();

    // Response sends DECRYPTED content to the authenticated sender
    const formatted = {
      _id: message._id,
      sender: formatUser(message.sender),
      content: plainContent,
      attachments: message.attachments || [],
      replyTo: replyToId,
      status: 'sent',
      deliveredTo: [],
      readBy: message.readBy?.map((id) => id.toString()) || [],
      createdAt: message.createdAt,
      conversationId,
    };

    // ── Emit via Socket.IO (decrypted — sent over WSS to authenticated sockets only) ──
    try {
      const io = getIO();
      // Send to conversation room
      io.to(`conversation:${conversationId}`).emit("message:new", formatted);

      // Also notify each OTHER participant's personal room
      // (so their conversation list updates even if they aren't in this convo room)
      for (const pid of conversation.participants) {
        const pidStr = pid.toString();
        if (pidStr !== userId) {
          // Single event per participant — client uses message:new for both
          // chat view AND conversation list update (via conversationMeta).
          io.to(`user:${pidStr}`).emit("message:new", {
            ...formatted,
            conversationMeta: {
              conversationId,
              lastMessage: {
                content: buildMessagePreview(plainContent, formatted.attachments),
                sender: userId,
                createdAt: message.createdAt,
              },
            },
          });
        }
      }
    } catch (_) {
      // Socket.IO not critical — message is saved
    }

    // ✅ NON-BLOCKING: Notification via RabbitMQ queue (parallel)
    const senderUser = await User.findById(userId).select('name').lean();
    const senderName = senderUser?.name || 'Someone';

    const notificationPromises = conversation.participants
      .map((pid) => pid.toString())
      .filter((pidStr) => pidStr !== userId)
      .map((pidStr) => {
        const notifyPromise = createAndEmitMessageNotification({
          recipientId: pidStr,
          senderId: userId,
          conversationId,
          senderName,
        });

        publishChatNotification({
          conversationId,
          senderId:       userId,
          senderName,
          recipientId:    pidStr,
          messagePreview: buildMessagePreview(plainContent, safeAttachments),
        }).catch(() => {});

        return notifyPromise;
      });

    Promise.allSettled(notificationPromises).catch(() => {});

    setNoCacheHeaders(res);
    res.status(201).json({ success: true, message: formatted, encrypted: isEncryptionEnabled() });
  } catch (error) {
    logger.error("Send message error:", error);
    res.status(500).json({ success: false, message: "Failed to send message" });
  }
};

// ==================== UPLOAD CHAT ATTACHMENT ====================
// POST /api/chat/conversations/:conversationId/attachments
exports.uploadAttachment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    if (!isValidId(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid conversationId" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Attachment file is required" });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    }).lean();

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const uploaded = await s3Service.uploadChatAttachment(
      req.file.buffer,
      userId,
      req.file.mimetype,
      req.file.originalname,
    );

    const attachment = {
      name: req.file.originalname || "Attachment",
      url: uploaded.url,
      key: uploaded.key,
      mimeType: req.file.mimetype,
      size: req.file.size,
      type: getAttachmentType(req.file.mimetype),
    };

    setNoCacheHeaders(res);
    return res.status(201).json({ success: true, attachment });
  } catch (error) {
    logger.error("Upload chat attachment error:", error);
    return res.status(500).json({ success: false, message: "Failed to upload attachment" });
  }
};

// ==================== DELETE MESSAGE FOR ME ====================
// DELETE /api/chat/conversations/:conversationId/messages/:messageId
exports.deleteMessageForMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId, messageId } = req.params;
    if (!isValidId(conversationId) || !isValidId(messageId)) {
      return res.status(400).json({ success: false, message: "Invalid conversationId or messageId" });
    }

    // Verify participation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const message = await Message.findOne({ _id: messageId, conversation: conversationId });
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Add user to deletedFor
    await Message.updateOne(
      { _id: messageId },
      { $addToSet: { deletedFor: userId } }
    );

    setNoCacheHeaders(res);
    res.status(200).json({ success: true, message: "Message deleted for you" });
  } catch (error) {
    logger.error("Delete message for me error:", error);
    res.status(500).json({ success: false, message: "Failed to delete message" });
  }
};

// ==================== DELETE MESSAGE FOR EVERYONE ====================
// DELETE /api/chat/conversations/:conversationId/messages/:messageId/everyone
exports.deleteMessageForEveryone = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId, messageId } = req.params;
    if (!isValidId(conversationId) || !isValidId(messageId)) {
      return res.status(400).json({ success: false, message: "Invalid conversationId or messageId" });
    }

    // Verify participation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const message = await Message.findOne({ _id: messageId, conversation: conversationId });
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Only the sender can delete for everyone
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Only the sender can delete for everyone" });
    }

    // Only allow delete-for-everyone within 1 hour of sending
    const ONE_HOUR = 60 * 60 * 1000;
    if (Date.now() - new Date(message.createdAt).getTime() > ONE_HOUR) {
      return res.status(400).json({ success: false, message: "Can only delete for everyone within 1 hour" });
    }

    // Clear content and attachments, mark as deleted for everyone
    await Message.updateOne(
      { _id: messageId },
      {
        $set: {
          content: encrypt("This message was deleted"),
          attachments: [],
          deletedForEveryone: true,
        },
      }
    );

    // Emit via Socket.IO so all participants see the deletion in real-time
    try {
      const io = getIO();
      const payload = { messageId, conversationId };
      io.to(`conversation:${conversationId}`).emit("message:deletedForEveryone", payload);
      // Also notify participants not currently in the conversation room
      for (const pid of conversation.participants) {
        const pidStr = pid.toString();
        if (pidStr !== userId) {
          io.to(`user:${pidStr}`).emit("message:deletedForEveryone", payload);
        }
      }
    } catch (_) {}

    setNoCacheHeaders(res);
    res.status(200).json({ success: true, message: "Message deleted for everyone" });
  } catch (error) {
    logger.error("Delete message for everyone error:", error);
    res.status(500).json({ success: false, message: "Failed to delete message" });
  }
};

// ==================== MARK CONVERSATION AS READ ====================
// PUT /api/chat/conversations/:conversationId/read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    if (!isValidId(conversationId)) {
      return res.status(400).json({ success: false, message: "Invalid conversationId" });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    // Reset unread count atomically
    await Conversation.updateOne(
      { _id: conversationId, participants: userId },
      { $set: { [`unreadCounts.${userId}`]: 0 } }
    );

    // Mark all messages in this conversation as read by this user
    await Message.updateMany(
      {
        conversation: conversationId,
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId }, $set: { status: 'read' } }
    );

    // Notify other participants that messages were read
    // Emit to both conversation room AND each other participant's personal room
    // so the sender sees blue ticks even if they haven't joined the conversation room
    try {
      const io = getIO();
      const readPayload = { conversationId, userId };
      io.to(`conversation:${conversationId}`).emit("messages:read", readPayload);
      // Also emit to each other participant's personal room
      for (const pid of conversation.participants) {
        const pidStr = pid.toString();
        if (pidStr !== userId) {
          io.to(`user:${pidStr}`).emit("messages:read", readPayload);
        }
      }
    } catch (_) {}

    setNoCacheHeaders(res);
    res.status(200).json({ success: true, message: "Marked as read" });
  } catch (error) {
    logger.error("Mark as read error:", error);
    res.status(500).json({ success: false, message: "Failed to mark as read" });
  }
};

// ==================== GET TOTAL UNREAD COUNT ====================
// GET /api/chat/unread-count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Use aggregation to sum unread counts server-side instead of
    // loading every conversation document into memory.
    const result = await Conversation.aggregate([
      { $match: { participants: new (require('mongoose').Types.ObjectId)(userId) } },
      { $project: { unread: { $ifNull: [`$unreadCounts.${userId}`, 0] } } },
      { $group: { _id: null, totalUnread: { $sum: '$unread' } } },
    ]);

    const totalUnread = result[0]?.totalUnread || 0;

    setNoCacheHeaders(res);
    res.status(200).json({ success: true, unreadCount: totalUnread });
  } catch (error) {
    logger.error("Get unread count error:", error);
    res.status(500).json({ success: false, message: "Failed to get unread count" });
  }
};

// ==================== MAKE OFFER (Chat + Email) ====================
// POST /api/chat/make-offer
// Body: { recipientId, listingId, listingType, listingTitle, offerAmount, listingPrice, productImage?, currency? }
exports.makeOffer = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { recipientId, listingId, listingType, listingTitle, offerAmount, listingPrice, productImage, currency } = req.body;

    if (!recipientId || !offerAmount || !listingTitle) {
      return res.status(400).json({ success: false, message: "recipientId, offerAmount, and listingTitle are required" });
    }
    if (!isValidId(recipientId)) {
      return res.status(400).json({ success: false, message: "Invalid recipientId" });
    }
    if (listingId && !isValidId(listingId)) {
      return res.status(400).json({ success: false, message: "Invalid listingId" });
    }
    if (recipientId === senderId) {
      return res.status(400).json({ success: false, message: "Cannot make an offer on your own listing" });
    }
    if (Number(offerAmount) <= 0) {
      return res.status(400).json({ success: false, message: "Offer amount must be greater than 0" });
    }

    // Fetch sender and recipient info
    const [sender, recipient] = await Promise.all([
      User.findById(senderId).select("name email"),
      User.findById(recipientId).select("name email preferences"),
    ]);
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient not found" });
    }

    // 1. Get or create conversation
    const query = {
      participants: { $all: [senderId, recipientId], $size: 2 },
    };
    if (listingId && listingType) {
      query["listing.listingId"] = listingId;
      query["listing.listingType"] = listingType;
    } else {
      query.$or = [
        { "listing.listingId": null },
        { "listing.listingId": { $exists: false } },
      ];
    }

    let conversation = await Conversation.findOne(query);
    if (!conversation) {
      const participants = getOrderedParticipantIds(senderId, recipientId);
      conversation = await Conversation.create({
        participants,
        listing: listingId
          ? {
              listingId,
              listingType,
              listingTitle,
              listingPrice: listingPrice != null ? Number(listingPrice) : null,
              listingImage: productImage || null,
              currency: currency || "₹",
            }
          : {
              listingId: null,
              listingType: null,
              listingTitle: null,
              listingPrice: null,
              listingImage: null,
              currency: "₹",
            },
        unreadCounts: new Map([[recipientId, 0], [senderId, 0]]),
      });
    }
    const conversationId = conversation._id;

    // 2. Format and send the offer message
    const offerFormatted = Number(offerAmount).toLocaleString('en-IN');
    const priceFormatted = listingPrice
      ? (typeof listingPrice === 'number' ? listingPrice.toLocaleString('en-IN') : String(listingPrice))
      : 'N/A';
    const currencySymbol = currency || '₹';
    const messageContent = `📋 **Offer for: ${listingTitle}**\n\n💰 Listed Price: ${currencySymbol}${priceFormatted}\n🏷️ My Offer: ${currencySymbol}${offerFormatted}\n\nHi, I'm interested in this item and would like to offer ${currencySymbol}${offerFormatted}. Please let me know if this works for you!`;

    const encryptedContent = encrypt(messageContent);

    let message = await Message.create({
      conversation: conversationId,
      sender: senderId,
      content: encryptedContent,
      readBy: [senderId],
    });

    // Atomically update conversation (race-safe)
    const incUpdate = {};
    for (const pid of conversation.participants) {
      const pidStr = pid.toString();
      if (pidStr !== senderId) {
        incUpdate[`unreadCounts.${pidStr}`] = 1;
      }
    }
    await Conversation.updateOne(
      { _id: conversationId },
      { $set: { lastMessage: message._id }, $inc: incUpdate },
    );

    // Populate sender
    message = await Message.findById(message._id)
      .populate("sender", "name profileImage googleProfileImage avatar provider")
      .lean();

    const formatted = {
      _id: message._id,
      sender: formatUser(message.sender),
      content: messageContent,
      attachments: [],
      status: 'sent',
      deliveredTo: [],
      readBy: message.readBy?.map((id) => id.toString()) || [],
      createdAt: message.createdAt,
      conversationId: conversationId.toString(),
    };

    // 3. Socket.IO — emit message
    try {
      const io = getIO();
      io.to(`conversation:${conversationId}`).emit("message:new", formatted);
      for (const pid of conversation.participants) {
        const pidStr = pid.toString();
        if (pidStr !== senderId) {
          io.to(`user:${pidStr}`).emit("conversation:updated", {
            conversationId: conversationId.toString(),
            lastMessage: { content: messageContent, sender: senderId, createdAt: message.createdAt },
          });
          io.to(`user:${pidStr}`).emit("message:new", formatted);
        }
      }
    } catch (_) {}

    // ✅ NON-BLOCKING: In-app notification via RabbitMQ
    for (const pid of conversation.participants) {
      const pidStr = pid.toString();
      if (pidStr !== senderId) {
        publishNotification({
          recipient:   pidStr,
          sender:      senderId,
          type:        'message',
          message:     `${sender?.name || 'Someone'} made an offer of ${currencySymbol}${offerFormatted} on "${listingTitle}"`,
          metadata:    { conversationId: conversationId.toString() },
        }).catch(() => {});
      }
    }

    // 5. Send email notification to the seller (fire and forget)
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const chatParams = new URLSearchParams({
      recipientId: senderId,
      listingId: listingId || '',
      listingType: listingType || '',
      listingTitle: listingTitle || '',
    });
    const chatUrl = `${clientUrl}/dashboard/messages?${chatParams.toString()}`;

    // ✅ NON-BLOCKING: Offer email via RabbitMQ (only if seller has email notifications enabled)
    if (recipient.preferences?.emailNotifications !== false) {
      publishOfferEmail({
        sellerEmail:  recipient.email,
        sellerName:   recipient.name || 'Seller',
        buyerName:    sender?.name || 'A buyer',
        productTitle: listingTitle,
        listingPrice: `${currencySymbol}${priceFormatted}`,
        offerPrice:   `${currencySymbol}${offerFormatted}`,
        productImage: productImage || null,
        chatUrl,
      }).catch(() => {});
    }

    setNoCacheHeaders(res);
    res.status(201).json({
      success: true,
      message: formatted,
      conversationId: conversationId.toString(),
    });
  } catch (error) {
    logger.error("Make offer error:", error);
    res.status(500).json({ success: false, message: "Failed to send offer" });
  }
};
