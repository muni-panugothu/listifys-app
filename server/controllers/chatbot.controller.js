const { logger } = require('../utils/logger');
const { VertexAI, HarmCategory, HarmBlockThreshold } = require('@google-cloud/vertexai');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Listifys AI Chatbot Controller — Powered by Vertex AI (Gemini)
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-1.5-flash';

// System instruction that makes the bot context-aware about Listifys
const SYSTEM_INSTRUCTION = `You are "Listifys Assistant" — a friendly, smart AI helper for Listifys, a local marketplace (think OLX + Facebook Marketplace combined). You help people buy, sell, and discover things near them.

WHAT LISTIFYS IS:
Listifys is a free online marketplace where anyone can post items for sale, find things to buy, hire services, discover events, find jobs, and more — all in their local area. No fees, no commissions. Just connect with real people nearby.

CATEGORIES AVAILABLE:
Electronics, Vehicles, For Sale (general), Properties, Jobs, Events, Services, Furniture, Fashion, Sports, Pets, Books, Toys, Collectibles, Beauty, Mobiles, and more.

HOW TO SELL (simple steps — like posting on OLX):
1. Sign in (free account via email or Google — takes 30 seconds)
2. Tap the "Post Ad" button in the navigation bar
3. Pick your category (e.g., Electronics, Vehicles, For Sale)
4. Add details — a clear title, honest price, good description, and your location
5. Upload up to 6 photos (tip: natural light + multiple angles = faster sale)
6. Hit "Submit" — your ad goes live instantly!
7. Buyers message you through the app — reply quickly to close deals
8. Meet in a safe public place, get paid, done!

HOW TO BUY (simple steps — like shopping on Marketplace):
1. Search or browse categories for what you want
2. Filter by price, location, or condition to narrow results
3. Open a listing to see photos, details, and seller info
4. Click "Chat with Seller" to ask questions or make an offer
5. Agree on price and meeting spot
6. Meet the seller, inspect the item, and pay — it's that simple!

WHEN USER IS NOT LOGGED IN:
If context says "USER_STATUS: NOT_LOGGED_IN" and they want to sell, post, or message:
→ Say: "You'll need to sign in first — it's free and takes just 30 seconds! Click 'Sign In' at the top, or use your Google account. Once you're in, I'll walk you through it."
→ Still explain the steps so they know what to expect.
If they're just browsing or asking questions — help them directly, no login needed.

YOUR PERSONALITY:
• Friendly and casual — like texting a helpful friend, not reading a manual
• Keep answers SHORT: 2-3 sentences for simple questions, bullet points for guides
• Use plain, simple English — avoid jargon, assume the user is new
• One emoji per message max (not required)
• If someone says "hi" or "hello" — greet them warmly and ask how you can help
• If you don't know something — say "I'm not sure about that, but you can reach our team through the Contact Us page!"
• NEVER invent features. NEVER share anyone's personal info
• When asked about fees: "Listifys is completely free — no listing fees, no commissions!"
• When asked about safety: mention in-app messaging, verified profiles, and meeting in public places

RESPONSE FORMAT:
• Plain text only — no markdown, no code blocks, no headers
• Use numbered steps (1, 2, 3) for guides
• Use "•" bullets for lists
• Sound like a real person, not a robot`;

// Initialize Vertex AI client (uses GOOGLE_APPLICATION_CREDENTIALS for auth)
let generativeModel = null;
let setupIssue = null;

const FALLBACK_ENABLED = process.env.CHATBOT_FALLBACK_ENABLED !== 'false';

function resolveCredentialsPath() {
  const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!configuredPath) return null;

  const absolutePath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(__dirname, '..', configuredPath);

  if (!fs.existsSync(absolutePath)) {
    setupIssue = 'CREDENTIALS_FILE_NOT_FOUND';
    logger.error('Chatbot: GOOGLE_APPLICATION_CREDENTIALS file not found', {
      configuredPath,
      resolvedPath: absolutePath,
    });
    return null;
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = absolutePath;
  return absolutePath;
}

function detectIntent(text = '') {
  const lower = String(text).toLowerCase();
  if (/sell|selling|post.*ad|create.*listing/.test(lower)) return 'sell';
  if (/buy|buying|purchase|find|search/.test(lower)) return 'buy';
  if (/safe|scam|fraud|report|verify/.test(lower)) return 'safety';
  if (/free|fee|cost|price/.test(lower)) return 'pricing';
  if (/category|categories|browse/.test(lower)) return 'categories';
  return 'general';
}

function buildFallbackReply(userMessage, isLoggedIn) {
  const intent = detectIntent(userMessage);

  if (intent === 'sell') {
    if (!isLoggedIn) {
      return "You'll need to sign in first — it's free and takes 30 seconds! Once you're in, tap 'Post Ad', pick a category, add your details and photos, and you're live. Buyers will message you right in the app.";
    }
    return "Here's how to sell: tap 'Post Ad' at the top, choose a category (like Electronics or For Sale), add a clear title, fair price, description, location, and up to 6 photos. Hit submit and your ad goes live instantly! Buyers will message you through the app.";
  }

  if (intent === 'buy') {
    return "Finding stuff is easy! Use the search bar or browse categories, then filter by price, location, or condition. Found something you like? Open the listing and tap 'Chat with Seller' to ask questions or make an offer. Agree on a meeting spot and you're all set!";
  }

  if (intent === 'safety') {
    return "Great question! Always chat through the app (not personal numbers), meet in busy public places during the day, and inspect items before paying. If something feels off, you can report the user from their profile. Your safety comes first!";
  }

  if (intent === 'pricing') {
    return "Listifys is completely free — no listing fees, no commissions, no hidden charges! Just post your ad and start selling. Tip: check similar listings in your area to set a competitive price.";
  }

  if (intent === 'categories') {
    return "We've got tons of categories! Electronics, Vehicles, Furniture, Fashion, Jobs, Properties, Services, Events, Pets, Sports, Books, Toys, and more. Just browse or search for what you need. What are you looking for?";
  }

  return "Hey there! I can help you with selling items, buying stuff, safety tips, account questions, or browsing categories. Try asking me something like 'How do I sell my phone?' or 'How do I contact a seller?' and I'll walk you through it!";
}

function sendFallback(res, userMessage, isLoggedIn, reason) {
  return res.status(200).json({
    success: true,
    reply: buildFallbackReply(userMessage, isLoggedIn),
    fallback: true,
    reason,
  });
}

function getModel() {
  if (generativeModel) return generativeModel;

  const projectId = process.env.VERTEX_AI_PROJECT_ID;
  const location = process.env.VERTEX_AI_LOCATION || 'us-central1';

  if (!projectId) {
    setupIssue = 'MISSING_PROJECT_ID';
    return null;
  }

  const resolvedCreds = resolveCredentialsPath();
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !resolvedCreds) {
    return null;
  }

  try {
    const vertexAI = new VertexAI({ project: projectId, location });

    generativeModel = vertexAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 300,
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
    });
    setupIssue = null;
  } catch (error) {
    setupIssue = 'MODEL_INIT_FAILED';
    logger.error('Chatbot: Failed to initialize Vertex model', {
      code: error?.code,
      message: error?.message,
      projectId,
      location,
    });
    return null;
  }

  return generativeModel;
}

/**
 * POST /api/chatbot/message
 * Body: { message: string, history?: Array<{role, text}>, isLoggedIn?: boolean, context?: string }
 * Returns: { success: true, reply: string }
 */
exports.sendMessage = async (req, res) => {
  try {
    const { message, history, isLoggedIn, context } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required.',
      });
    }

    const model = getModel();
    if (!model) {
      logger.warn('Chatbot: Vertex model unavailable, serving fallback response', {
        setupIssue,
      });
      if (FALLBACK_ENABLED) {
        return sendFallback(res, message, !!isLoggedIn, setupIssue || 'MODEL_UNAVAILABLE');
      }
      return res.status(503).json({
        success: false,
        message: 'AI chatbot is temporarily unavailable.',
      });
    }

    // Limit message length to prevent abuse
    const userStatus = isLoggedIn ? 'LOGGED_IN' : 'NOT_LOGGED_IN';
    let trimmedMessage = `[USER_STATUS: ${userStatus}] ${message.trim().slice(0, 1000)}`;

    // Inject product context if provided (for product-aware responses)
    // Sanitize: strip any instruction-like prefixes to prevent prompt injection
    if (context && typeof context === 'string') {
      const sanitized = context.slice(0, 500)
        .replace(/^(system|instruction|role|prompt)\s*[:=]/gi, '')
        .replace(/ignore (previous|above|all) (instructions?|prompts?)/gi, '');
      trimmedMessage = `[Product Context: ${sanitized}]\n\n${trimmedMessage}`;
    }

    // Build conversation history for context
    const contents = [];

    // Add conversation history (last 10 turns max to keep token usage reasonable)
    if (Array.isArray(history)) {
      const recentHistory = history.slice(-20); // 10 user + 10 bot messages
      for (const entry of recentHistory) {
        // Only accept 'user' role from client input; 'model' turns must be
        // reconstructed server-side or stripped to prevent prompt injection.
        if (entry.role === 'user') {
          contents.push({
            role: 'user',
            parts: [{ text: typeof entry.text === 'string' ? entry.text.slice(0, 1000) : '' }],
          });
        }
      }
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: trimmedMessage }],
    });

    // Call Vertex AI Gemini
    const result = await model.generateContent({ contents });
    const response = result.response;

    // Extract the reply text
    const reply =
      response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm sorry, I couldn't process that. Could you try rephrasing your question?";

    return res.status(200).json({
      success: true,
      reply: reply.trim(),
    });
  } catch (error) {
    logger.error('Chatbot: Vertex AI error', { message: error.message, code: error.code });

    // Reset cached model on auth/config errors so it re-initializes on next request
    if (error.code === 403 || error.code === 401 || error.message?.includes('PERMISSION_DENIED')) {
      generativeModel = null;
    }

    // Handle rate limit / quota errors
    if (error.code === 429 || error.message?.includes('RESOURCE_EXHAUSTED')) {
      if (FALLBACK_ENABLED) {
        return sendFallback(res, req.body?.message, !!req.body?.isLoggedIn, 'RATE_LIMIT');
      }
      return res.status(429).json({
        success: false,
        message: 'Our AI assistant is experiencing high demand. Please try again in a moment.',
      });
    }

    // Handle permission / API not enabled errors
    if (error.code === 403 || error.message?.includes('PERMISSION_DENIED') || error.message?.includes('SERVICE_DISABLED')) {
      setupIssue = 'PERMISSION_OR_API_DISABLED';
      logger.error('Chatbot: Vertex AI API is not enabled or has insufficient permissions', { project: process.env.VERTEX_AI_PROJECT_ID });
      if (FALLBACK_ENABLED) {
        return sendFallback(res, req.body?.message, !!req.body?.isLoggedIn, setupIssue);
      }
      return res.status(503).json({
        success: false,
        message: 'AI chatbot is being set up. Please try again later.',
      });
    }

    if (FALLBACK_ENABLED) {
      return sendFallback(res, req.body?.message, !!req.body?.isLoggedIn, 'UNKNOWN_ERROR');
    }

    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
  }
};

/**
 * GET /api/chatbot/health
 * Simple health check for the chatbot service
 */
exports.healthCheck = (req, res) => {
  const configuredCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const resolvedCredentials = configuredCredentials
    ? (path.isAbsolute(configuredCredentials)
      ? configuredCredentials
      : path.resolve(__dirname, '..', configuredCredentials))
    : null;

  res.status(200).json({
    success: true,
    configured: !!process.env.VERTEX_AI_PROJECT_ID,
    credentialsConfigured: !!configuredCredentials,
    credentialsFileExists: resolvedCredentials ? fs.existsSync(resolvedCredentials) : false,
    fallbackEnabled: FALLBACK_ENABLED,
    ready: !!generativeModel,
    setupIssue,
    model: GEMINI_MODEL,
  });
};
