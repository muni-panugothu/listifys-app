const express = require('express');
const router = express.Router();
const { sendMessage, healthCheck } = require('../controllers/chatbot.controller');

// Public endpoints — no auth required (chatbot is available to all visitors)
router.post('/message', sendMessage);
router.get('/health', healthCheck);

module.exports = router;
