const express = require('express');
const router = express.Router();
const s3Service = require('../services/s3.service');
const { protect } = require('../middleware/auth.middleware');
const { logger } = require('../utils/logger');

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/avif', 'image/heic', 'image/heif', 'image/gif',
];

const ALLOWED_FOLDERS = ['listings', 'electronics', 'jobs', 'vehicles', 'profiles', 'services', 'properties'];

/**
 * POST /api/s3/presign
 * Body: { folder: 'electronics', mimeType: 'image/jpeg' }
 * Returns a time-limited pre-signed PUT URL for direct browser-to-S3 upload.
 */
router.post('/presign', protect, async (req, res) => {
  try {
    const { folder = 'listings', mimeType } = req.body;
    const userId = req.user._id.toString();

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({ success: false, message: 'Unsupported file type.' });
    }

    const safeFolder = folder.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!ALLOWED_FOLDERS.includes(safeFolder)) {
      return res.status(400).json({ success: false, message: 'Invalid upload folder.' });
    }

    const prefix = `${safeFolder}/${userId}/`;
    const result = await s3Service.getPresignedUploadUrl(prefix, mimeType);

    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('S3 presign error', { error: err.message });
    res.status(500).json({ success: false, message: 'Could not generate upload URL.' });
  }
});

module.exports = router;
