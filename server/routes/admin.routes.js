const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth.middleware");
const adminController = require("../controllers/admin.controller");
const { metrics, QUEUES }    = require("../queues/rabbitmq");

// All routes require admin auth
router.use(protect, authorize("admin"));

// Dashboard
router.get("/stats", adminController.getDashboardStats);
router.get("/activity", adminController.getRecentActivity);

// Users
router.get("/users", adminController.getUsers);
router.get("/users/:id", adminController.getUserDetail);
router.put("/users/:id", adminController.updateUser);
router.get("/users/:id/listings", adminController.getUserListings);

// Conversations
router.get("/conversations", adminController.getConversations);
router.get("/conversations/:conversationId/messages", adminController.getConversationMessages);

// Listings
router.get("/listings", adminController.getAllListings);
router.delete("/listings/:listingType/:listingId", adminController.deleteListing);

// ── Queue Health ──────────────────────────────────────────────────────────────
/**
 * GET /api/admin/queue-health
 * Returns RabbitMQ metrics for ops monitoring dashboards.
 * Covers: throughput (published/consumed/retried/dead-lettered),
 * circuit-breaker state, and queue registry.
 */
router.get("/queue-health", (req, res) => {
  const uptime   = process.uptime();
  const queueList = Object.entries(QUEUES).map(([key, def]) => ({
    key,
    name:     def.name,
    dlq:      def.dlq,
    priority: def.priority,
  }));

  res.json({
    status:    metrics.circuitOpen ? 'degraded' : 'healthy',
    uptime:    Math.floor(uptime),
    queues:    queueList,
    metrics: {
      published:    metrics.published,
      consumed:     metrics.consumed,
      retried:      metrics.retried,
      deadLettered: metrics.deadLettered,
      failed:       metrics.failed,
      circuitOpen:  metrics.circuitOpen,
    },
    rates: {
      // Simple rolling rate since server start (msgs/min)
      publishedPerMin: uptime > 0 ? +(metrics.published / (uptime / 60)).toFixed(2) : 0,
      consumedPerMin:  uptime > 0 ? +(metrics.consumed  / (uptime / 60)).toFixed(2) : 0,
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
