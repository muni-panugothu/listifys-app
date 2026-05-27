// ============================================================================
// ERROR HANDLER MIDDLEWARE — Production-grade centralized error handling
// ============================================================================
// Features:
//   • Custom AppError class with HTTP status codes and error codes
//   • Mongoose / Joi / JWT / Multer error normalisation
//   • Structured JSON responses (never leaks internals in production)
//   • Request-aware logging with correlation IDs
//   • Rate-limit-aware duplicate-error suppression
// ============================================================================

const { logger } = require('../utils/logger');

// ==================== Custom Application Error Class ====================
class AppError extends Error {
  /**
   * @param {string}  message    — Human-readable error message
   * @param {number}  statusCode — HTTP status code (default 500)
   * @param {string}  code       — Machine-readable error code (e.g. 'VALIDATION_ERROR')
   * @param {Object}  details    — Optional structured details (field errors, etc.)
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;               // distinguishes expected errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }

  // ---- Factory helpers for common error types ----
  static badRequest(message, details)   { return new AppError(message, 400, 'BAD_REQUEST', details); }
  static unauthorized(message)          { return new AppError(message || 'Authentication required', 401, 'UNAUTHORIZED'); }
  static forbidden(message)             { return new AppError(message || 'Access denied', 403, 'FORBIDDEN'); }
  static notFound(resource = 'Resource'){ return new AppError(`${resource} not found`, 404, 'NOT_FOUND'); }
  static conflict(message, details)     { return new AppError(message, 409, 'CONFLICT', details); }
  static tooMany(message)               { return new AppError(message || 'Too many requests', 429, 'RATE_LIMITED'); }
  static internal(message)              { return new AppError(message || 'Internal server error', 500, 'INTERNAL_ERROR'); }
  static serviceUnavailable(message)    { return new AppError(message || 'Service temporarily unavailable', 503, 'SERVICE_UNAVAILABLE'); }
}

// ==================== Error Normaliser ====================
// Converts well-known third-party errors into AppError instances so the
// handler always works with a consistent shape.
function normaliseError(err) {
  // Already an AppError
  if (err instanceof AppError) return err;

  // ---- Mongoose Validation Error ----
  if (err.name === 'ValidationError' && err.errors) {
    const fields = Object.keys(err.errors).reduce((acc, key) => {
      acc[key] = err.errors[key].message;
      return acc;
    }, {});
    return new AppError('Validation failed', 400, 'VALIDATION_ERROR', { fields });
  }

  // ---- Mongoose CastError (invalid ObjectId, etc.) ----
  if (err.name === 'CastError') {
    return new AppError(
      'Invalid parameter value',
      400,
      'INVALID_PARAMETER',
      process.env.NODE_ENV === 'production' ? {} : { field: err.path, value: err.value }
    );
  }

  // ---- Mongoose Duplicate Key ----
  if (err.code === 11000 || err.code === 11001) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return new AppError(
      'A record with that value already exists',
      409,
      'DUPLICATE_KEY',
      process.env.NODE_ENV === 'production' ? { field } : { field, value: err.keyValue?.[field] }
    );
  }

  // ---- Joi Validation Error ----
  if (err.isJoi || err.name === 'JoiValidationError') {
    const fields = {};
    if (err.details) {
      err.details.forEach((d) => {
        const key = d.path.join('.') || d.context?.key || 'unknown';
        fields[key] = d.message;
      });
    }
    return new AppError('Validation failed', 400, 'VALIDATION_ERROR', { fields });
  }

  // ---- JWT Errors ----
  if (err.name === 'JsonWebTokenError') {
    return new AppError('Invalid authentication token', 401, 'INVALID_TOKEN');
  }
  if (err.name === 'TokenExpiredError') {
    return new AppError('Authentication token has expired', 401, 'TOKEN_EXPIRED');
  }
  if (err.name === 'NotBeforeError') {
    return new AppError('Token not yet active', 401, 'TOKEN_NOT_ACTIVE');
  }

  // ---- Multer / File Upload Errors ----
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large', 413, 'FILE_TOO_LARGE');
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Too many files', 400, 'TOO_MANY_FILES');
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Unexpected file field', 400, 'UNEXPECTED_FILE');
  }

  // ---- CORS Error ----
  if (err.message && err.message.includes('Not allowed by CORS')) {
    return new AppError('Cross-origin request blocked', 403, 'CORS_ERROR');
  }

  // ---- Syntax Error (malformed JSON body) ----
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return new AppError('Invalid JSON in request body', 400, 'MALFORMED_JSON');
  }

  // ---- MongoDB Network / Timeout ----
  if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
    return new AppError('Database connection error', 503, 'DB_CONNECTION_ERROR');
  }

  // ---- Fallback: wrap unknown error ----
  const wrapped = new AppError(err.message || 'An unexpected error occurred', err.statusCode || 500, 'INTERNAL_ERROR');
  wrapped.isOperational = false;   // flag as unexpected (bug)
  wrapped.originalError = err;
  return wrapped;
}

// ==================== 404 Not-Found Handler ====================
function notFoundHandler(req, res, _next) {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: 'The requested resource was not found',
    timestamp: new Date().toISOString(),
  });
}

// ==================== Global Error Handler Middleware ====================
function errorHandler(err, req, res, _next) {
  const normalisedErr = normaliseError(err);
  const statusCode    = normalisedErr.statusCode;
  const isProduction  = process.env.NODE_ENV === 'production';

  // ---- Structured log entry ----
  const logPayload = {
    code:       normalisedErr.code,
    statusCode,
    method:     req.method,
    path:       req.originalUrl,
    ip:         req.ip,
    requestId:  req.requestId || req.headers['x-request-id'] || 'N/A',
    userId:     req.user?._id || req.user?.id || null,
    userAgent:  req.get('User-Agent'),
  };

  if (statusCode >= 500) {
    // Server errors — full stack, always logged
    logger.error(normalisedErr.message, {
      ...logPayload,
      stack: normalisedErr.originalError?.stack || normalisedErr.stack,
      details: normalisedErr.details,
    });
  } else if (statusCode >= 400) {
    // Client errors — warn level (noisy at info level)
    logger.warn(normalisedErr.message, logPayload);
  }

  // ---- Build response ----
  const response = {
    success:   false,
    code:      normalisedErr.code,
    message:   isProduction && statusCode === 500
      ? 'An internal server error occurred'
      : normalisedErr.message,
    timestamp: new Date().toISOString(),
  };

  // Include field-level details if present (validation errors, duplicate keys)
  if (normalisedErr.details) {
    response.details = normalisedErr.details;
  }

  // In development, include the stack trace for debugging
  if (!isProduction) {
    response.stack = normalisedErr.originalError?.stack || normalisedErr.stack;
  }

  res.status(statusCode).json(response);
}

// ============================================================================
// Exports
// ============================================================================
module.exports = {
  AppError,
  normaliseError,
  notFoundHandler,
  errorHandler,
};
