const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const settingsController = require("../controllers/settings.controller");

// All settings routes require authentication
router.use(protect);

// GET /api/settings/preferences — get notification preferences
router.get("/preferences", settingsController.getPreferences);

// PUT /api/settings/preferences — update notification preferences
router.put("/preferences", settingsController.updatePreferences);

// POST /api/settings/delete-account — permanently delete account
router.post("/delete-account", settingsController.deleteAccount);

module.exports = router;
