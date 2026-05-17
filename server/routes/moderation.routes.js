const express = require('express');
const multer = require('multer');
const { analyzeImages } = require('../services/imagemoderation.service');
const { protect } = require('../middleware/auth.middleware');
const { logger } = require('../utils/logger');

const router = express.Router();

// Multer config: memory storage, max 6 images, 10MB each
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

/**
 * POST /api/moderation/check-images
 * Accepts multipart form with "images" field.
 * Returns moderation decision for each image.
 */
router.post(
  '/check-images',
  protect,
  upload.array('images', 6),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No images provided',
        });
      }

      const images = req.files.map((file) => ({
        buffer: file.buffer,
        filename: file.originalname,
      }));

      const results = await analyzeImages(images);

      // Determine overall decision
      const hasBlock = results.some((r) => r.decision === 'block');
      const hasReview = results.some((r) => r.decision === 'review');

      let overallDecision = 'allow';
      if (hasBlock) overallDecision = 'block';
      else if (hasReview) overallDecision = 'review';

      return res.json({
        success: true,
        overallDecision,
        results,
      });
    } catch (err) {
      logger.error('Image moderation error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Image moderation check failed',
      });
    }
  },
);

module.exports = router;
