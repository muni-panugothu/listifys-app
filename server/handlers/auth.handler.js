'use strict';

const { logger }      = require('../utils/logger');
const { ROUTING_KEYS } = require('../messaging/config/messaging.config');

/**
 * AuthHandler — processes events consumed from auth.events.q.
 *
 * Wire it to a consumer in notification.worker.js or a dedicated auth.worker.js:
 *   await ConsumerService.consume(QUEUES.AUTH_EVENTS.name,
 *     (payload, envelope) => AuthHandler.handle(payload, envelope));
 */
const AuthHandler = {
  async handle(payload, envelope) {
    const { routingKey } = envelope;
    switch (routingKey) {
      case ROUTING_KEYS.AUTH.USER_CREATED:   return AuthHandler.onUserCreated(payload, envelope);
      case ROUTING_KEYS.AUTH.USER_VERIFIED:  return AuthHandler.onUserVerified(payload, envelope);
      case ROUTING_KEYS.AUTH.USER_LOGIN:     return AuthHandler.onUserLogin(payload, envelope);
      case ROUTING_KEYS.AUTH.USER_LOGOUT:    return AuthHandler.onUserLogout(payload, envelope);
      case ROUTING_KEYS.AUTH.USER_BLOCKED:   return AuthHandler.onUserBlocked(payload, envelope);
      case ROUTING_KEYS.AUTH.PASSWORD_RESET: return AuthHandler.onPasswordReset(payload, envelope);
      default:
        logger.debug('[AuthHandler] Unknown routing key', { routingKey });
    }
  },

  async onUserCreated(payload) {
    const { userId, email, name } = payload;
    logger.info('[AuthHandler] New user registered', { userId, email });
    // Wire in actual side-effects:
    // await NotificationProducer.email(email, 'welcome', { name });
    // await SearchService.indexUser(userId);
  },

  async onUserVerified(payload) {
    const { userId } = payload;
    logger.info('[AuthHandler] User verified', { userId });
    // await UserService.grantVerifiedBadge(userId);
  },

  async onUserLogin(payload) {
    const { userId, ip } = payload;
    logger.debug('[AuthHandler] User login', { userId, ip });
    // await AuditLogService.record('login', userId, { ip });
    // await SecurityService.checkSuspiciousLogin(userId, ip);
  },

  async onUserLogout(payload) {
    logger.debug('[AuthHandler] User logout', { userId: payload.userId });
  },

  async onUserBlocked(payload) {
    const { userId, reason, blockedBy } = payload;
    logger.warn('[AuthHandler] User blocked', { userId, reason, blockedBy });
    // await SessionService.revokeAll(userId);
    // await ListingService.deactivateAllForUser(userId);
  },

  async onPasswordReset(payload) {
    const { userId, email } = payload;
    logger.info('[AuthHandler] Password reset', { userId });
    // await AuditLogService.record('password_reset', userId);
    // await NotificationProducer.email(email, 'password-changed', {});
  },
};

module.exports = AuthHandler;
