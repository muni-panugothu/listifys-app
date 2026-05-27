const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contact.controller");
const { createRateLimiter } = require("../middleware/ratelimiter.middleware");

// Strict rate limit: 3 contact submissions per IP per 15 minutes
const contactLimiter = createRateLimiter({
  keyPrefix: 'rl:contact',
  windowSec: 900,
  maxHits: 3,
  message: 'Too many contact submissions. Please try again later.',
  failClosed: true,
});

router.post("/", contactLimiter, contactController.submitContactForm);

module.exports = router;
