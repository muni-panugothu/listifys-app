const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth.middleware");
const adminController = require("../controllers/admin.controller");

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

module.exports = router;
