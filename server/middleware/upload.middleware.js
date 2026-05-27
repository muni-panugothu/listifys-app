const multer = require('multer');
const { logger } = require('../utils/logger');
const { compressionMiddleware } = require('../services/imagecompressor.service.js');

const storage = multer.memoryStorage();

// Magic byte signatures for image formats
const MAGIC_BYTES = {
  'ffd8ff':       'image/jpeg',     // JPEG
  '89504e47':     'image/png',      // PNG
  '47494638':     'image/gif',      // GIF
  '52494646':     'image/webp',     // RIFF (WebP container)
  '424d':         'image/bmp',      // BMP
  '49492a00':     'image/tiff',     // TIFF (little-endian)
  '4d4d002a':     'image/tiff',     // TIFF (big-endian)
};

// ISOBMFF brands for HEIF/HEIC/AVIF (ISO Base Media File Format)
const ISOBMFF_IMAGE_BRANDS = new Set([
  'heic', 'heix', 'hevc', 'hevx',  // HEIC
  'heim', 'heis', 'hevm', 'hevs',  // HEIF sequences
  'mif1', 'msf1',                   // HEIF
  'avif', 'avis',                   // AVIF
]);

/**
 * Validate actual file content against magic bytes.
 * Prevents content-type spoofing attacks.
 */
const validateMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 12) return false;
  const hex = buffer.slice(0, 8).toString('hex').toLowerCase();

  // Check standard image magic bytes
  for (const [magic] of Object.entries(MAGIC_BYTES)) {
    if (hex.startsWith(magic)) return true;
  }

  // Check ISOBMFF container (HEIF/HEIC/AVIF): bytes 4-7 must be 'ftyp'
  const ftypMarker = buffer.slice(4, 8).toString('ascii');
  if (ftypMarker === 'ftyp') {
    const brand = buffer.slice(8, 12).toString('ascii').toLowerCase();
    if (ISOBMFF_IMAGE_BRANDS.has(brand)) return true;
  }

  return false;
};

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'image/avif', 'image/heic', 'image/heif', 'image/bmp', 'image/tiff',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, HEIC, AVIF, BMP, and TIFF are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per file (reduced from 50MB — server compresses after upload)
    files: 6,                    // Max 6 files per request
    fieldSize: 2 * 1024 * 1024,  // Max field value size (2MB)
  },
  fileFilter: fileFilter,
});

/**
 * Post-upload magic byte validation middleware.
 * Runs AFTER multer processes buffers, rejects files with spoofed MIME types.
 */
const validateUploadedFiles = (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);
  for (const file of files) {
    if (!validateMagicBytes(file.buffer)) {
      logger.securityLog('upload_magic_byte_mismatch', {
        ip: req.ip,
        originalname: file.originalname,
        claimedMime: file.mimetype,
      });
      return res.status(400).json({
        success: false,
        message: `File "${file.originalname}" has invalid content. The file does not match its claimed type.`,
        code: 'INVALID_FILE_CONTENT',
      });
    }
  }
  next();
};

// Wrap multer methods to auto-chain magic-byte validation
const _origArray = upload.array.bind(upload);
const _origSingle = upload.single.bind(upload);
const _origFields = upload.fields.bind(upload);

upload.array = (...args) => {
  const multerMiddleware = _origArray(...args);
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) return next(err);
      validateUploadedFiles(req, res, next);
    });
  };
};

upload.single = (...args) => {
  const multerMiddleware = _origSingle(...args);
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) return next(err);
      validateUploadedFiles(req, res, next);
    });
  };
};

upload.fields = (...args) => {
  const multerMiddleware = _origFields(...args);
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) return next(err);
      validateUploadedFiles(req, res, next);
    });
  };
};

/**
 * Middleware to compress listing images via adaptive multi-pass compressor.
 * - Targets ~120KB per image
 * - Converts to WebP, strips EXIF
 */
const optimiseImages = compressionMiddleware('listing');

/**
 * Middleware to compress profile images.
 * - Targets ~60KB per image
 */
const optimiseProfileImage = compressionMiddleware('profile');

module.exports = upload;
module.exports.optimiseImages = optimiseImages;
module.exports.optimiseProfileImage = optimiseProfileImage;
module.exports.validateUploadedFiles = validateUploadedFiles;
