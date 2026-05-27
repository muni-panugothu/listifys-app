'use strict';
/**
 * ── Audit Log Consumer ─────────────────────────────────────────────────────────
 * Processes: audit_log_queue
 * Stores all user auth activity to MongoDB (AuditLog collection) asynchronously.
 * This keeps the auth API latency low — no DB write during request lifecycle.
 */
const { consume, QUEUES } = require('../rabbitmq');
const mongoose = require('mongoose');
const { logger } = require('../../utils/logger');

// ── Lightweight AuditLog model (stored in same MongoDB) ─────────────────────
const auditLogSchema = new mongoose.Schema(
  {
    userId:    { type: String, index: true },
    email:     { type: String },        // masked in logs, stored raw for admin queries
    action:    { type: String, required: true, index: true },
    ip:        { type: String },
    userAgent: { type: String },
    metadata:  { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
  },
  {
    collection: 'audit_logs',
    // Auto-expire audit logs after 90 days (TTL index)
    expireAfterSeconds: undefined, // set via TTL index below
  }
);

// TTL index: auto-delete audit logs older than 90 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

// ── Start Audit Log Consumer ────────────────────────────────────────────────
const startAuditLogConsumer = async () => {
  await consume(
    QUEUES.AUDIT_LOG.name,
    async (payload) => {
      const { userId, email, action, ip, userAgent, metadata, timestamp } = payload;

      await AuditLog.create({
        userId,
        email,
        action,
        ip,
        userAgent,
        metadata,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      });

      logger.info('[AuditConsumer] ✅ Audit log stored', { action, userId });
    },
    { maxRetries: 5 } // Higher retry — audit logs are important
  );

  logger.info('[AuditConsumer] ✅ Audit log consumer started');
};

module.exports = { startAuditLogConsumer, AuditLog };