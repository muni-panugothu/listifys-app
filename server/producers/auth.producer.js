'use strict';

const EventBus = require('../messaging/EventBusService');

/**
 * AuthProducer — fire auth domain events from controllers/services.
 *
 * Usage:
 *   const AuthProducer = require('../producers/auth.producer');
 *   await AuthProducer.userCreated(user, { correlationId: req.id });
 */
const AuthProducer = {
  async userCreated(user, meta = {}) {
    return EventBus.userCreated(user._id?.toString() ?? user.id, {
      email:     user.email,
      name:      user.name ?? user.displayName,
      provider:  user.provider ?? 'local',
      createdAt: user.createdAt?.toISOString?.() ?? new Date().toISOString(),
    }, meta);
  },

  async userVerified(user, meta = {}) {
    return EventBus.userVerified(user._id?.toString() ?? user.id, {
      email:      user.email,
      verifiedAt: new Date().toISOString(),
    }, meta);
  },

  async userLogin(user, reqMeta = {}, meta = {}) {
    return EventBus.userLogin(user._id?.toString() ?? user.id, {
      ip:        reqMeta.ip,
      userAgent: reqMeta.userAgent,
      provider:  user.provider ?? 'local',
      loginAt:   new Date().toISOString(),
    }, meta);
  },

  async userLogout(userId, meta = {}) {
    return EventBus.userLogout(userId, meta);
  },

  async userBlocked(userId, reason, adminId, meta = {}) {
    return EventBus.userBlocked(userId, {
      reason,
      blockedBy: adminId,
      blockedAt: new Date().toISOString(),
    }, meta);
  },

  async passwordReset(user, meta = {}) {
    return EventBus.passwordReset(
      user._id?.toString() ?? user.id,
      user.email,
      meta,
    );
  },
};

module.exports = AuthProducer;
