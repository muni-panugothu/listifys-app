const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');
const crypto = require('crypto');


const isProduction = process.env.NODE_ENV === 'production';
const SERVICE_NAME = process.env.SERVICE_NAME || 'listify-api';
const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS, 10) || 90;
const LOG_ENV = process.env.LOG_ENV || (isProduction ? 'production' : 'development');

// Stable stream name per server instance for CloudWatch ordering
const INSTANCE_ID =
  process.env.INSTANCE_ID ||
  `${require('os').hostname()}-${process.pid}`;


const SENSITIVE_KEYS = new Set([
  'password', 'newpassword', 'currentpassword', 'confirmpassword',
  'token', 'accesstoken', 'refreshtoken', 'resettoken', 'otp',
  'secret', 'secretaccesskey', 'authorization', 'cookie',
]);

const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

const maskEmail = (email) => {
  const [local, domain] = email.split('@');
  if (!domain) return '***@***';
  return `${local.slice(0, 2)}***@${domain}`;
};

const hashValue = (val) =>
  crypto.createHash('sha256').update(String(val)).digest('hex').substring(0, 12);

/**
 * Deep-clone and sanitize an object, redacting PII.
 */
const sanitize = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return obj.replace(EMAIL_REGEX, (_, local, domain) =>
      `${local.slice(0, 2)}***@${domain}`
    );
  }
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      clean[key] = value ? `[HASH:${hashValue(value)}]` : '[EMPTY]';
    } else if (
      lowerKey === 'email' ||
      lowerKey === 'selleremail' ||
      lowerKey === 'registrationemail' ||
      lowerKey === 'resetemail'
    ) {
      clean[key] = typeof value === 'string' ? maskEmail(value) : '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
};


const sanitizeFormat = winston.format((info) => {
  if (typeof info.message === 'string') {
    info.message = info.message.replace(EMAIL_REGEX, (_, local, domain) =>
      `${local.slice(0, 2)}***@${domain}`
    );
  }
  for (const key of Object.keys(info)) {
    if (key === 'level' || key === 'message' || key === 'timestamp' || key === 'service') continue;
    info[key] = sanitize(info[key]);
  }
  return info;
});


const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  sanitizeFormat(),
  winston.format.json()
);


const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  sanitizeFormat(),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0
      ? '\n' + JSON.stringify(meta, null, 2)
      : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);


/**
 * Creates a winston-cloudwatch transport for a specific log group.
 *
 * @param {string} logGroupName   e.g. '/listify/production/errors'
 * @param {string} [filterLevel]  only ship logs >= this level (null = all)
 * @param {Function} [filterFn]   custom filter returning true to include
 */
const createCloudWatchTransport = (logGroupName, filterLevel = null, filterFn = null) => {
  const transport = new WinstonCloudWatch({
    logGroupName,
    logStreamName: `${SERVICE_NAME}/${INSTANCE_ID}`,
    awsRegion: process.env.AWS_REGION,
    awsOptions: {
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    },
    createLogGroup: true,
    createLogStream: true,
    retentionInDays: LOG_RETENTION_DAYS,
    // Batch settings for high throughput (million-user scale)
    uploadRate: 2000,           // flush every 2 seconds
    batchSize: 25,              // or every 25 messages
    jsonMessage: true,
    messageFormatter: (logEntry) => {
      return JSON.stringify({
        timestamp: logEntry.timestamp || new Date().toISOString(),
        level: logEntry.level,
        message: logEntry.message,
        service: SERVICE_NAME,
        instance: INSTANCE_ID,
        environment: LOG_ENV,
        ...logEntry,
      });
    },
    level: filterLevel || 'info',
  });

  // Apply custom filter if provided
  if (filterFn) {
    const originalLog = transport.log.bind(transport);
    transport.log = function (info, callback) {
      if (filterFn(info)) {
        return originalLog(info, callback);
      }
      if (callback) callback();
    };
  }

  // Don't crash the server on transport errors
  transport.on('error', (err) => {
    // Use raw console since this IS the logger failing
    console.error(`[CloudWatch:${logGroupName}] Transport error:`, err.message);
  });

  return transport;
};


const isProductLog = (info) =>
  typeof info.message === 'string' &&
  (info.message.includes('[PRODUCT_POSTED]') ||
   info.message.includes('[PRODUCT_UPDATED]') ||
   info.message.includes('[PRODUCT_DELETED]') ||
   info.message.includes('[VALIDATION_FAILED]'));

const isUserLog = (info) =>
  typeof info.message === 'string' &&
  (info.message.includes('[USER_LOGIN]') ||
   info.message.includes('[USER_REGISTER]') ||
   info.message.includes('[USER_LOGOUT]') ||
   info.message.includes('[USER_PASSWORD]') ||
   info.message.includes('[USER_PROFILE]') ||
   info.message.includes('[USER_SESSION]') ||
   info.message.includes('[USER_OTP]'));

const isSecurityLog = (info) =>
  typeof info.message === 'string' &&
  (info.message.includes('[SECURITY]') ||
   info.message.includes('CSRF') ||
   info.message.includes('Rate limit') ||
   info.message.includes('blocked') ||
   info.message.includes('suspicious'));


const transports = [];

if (isProduction) {
  // ★ CloudWatch: General application logs
  transports.push(
    createCloudWatchTransport(`/listify/${LOG_ENV}/application`, 'info')
  );

  // ★ CloudWatch: Errors only (for CloudWatch Alarms / dashboards)
  transports.push(
    createCloudWatchTransport(`/listify/${LOG_ENV}/errors`, 'error')
  );

  // ★ CloudWatch: Product activity (posted/updated/deleted)
  transports.push(
    createCloudWatchTransport(`/listify/${LOG_ENV}/products`, 'info', isProductLog)
  );

  // ★ CloudWatch: User activity (login/register/logout/password)
  transports.push(
    createCloudWatchTransport(`/listify/${LOG_ENV}/users`, 'info', isUserLog)
  );

  // ★ CloudWatch: Security events (CSRF, rate limits, blocks)
  transports.push(
    createCloudWatchTransport(`/listify/${LOG_ENV}/security`, 'warn', isSecurityLog)
  );

  // ★ Console: Always log to stdout in production so `docker logs` works
  transports.push(
    new winston.transports.Console({ level: 'info', format: consoleFormat })
  );
} else {
  // ── Development: console only (NO local files, NO CloudWatch) ───
  transports.push(
    new winston.transports.Console({ format: consoleFormat })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: baseFormat,
  defaultMeta: { service: SERVICE_NAME },
  transports,
  exitOnError: false,
});


logger.stream = {
  write: (message) => logger.info(message.trim()),
};


/**
 * Log user lifecycle events — login, register, logout, password changes.
 * Routes to /listify/{env}/users CloudWatch log group.
 *
 * @param {'login'|'register'|'logout'|'password'|'profile'|'session'|'otp'} action
 * @param {Object} opts
 * @param {string}  opts.userId
 * @param {string}  [opts.email]      — auto-masked by sanitizer
 * @param {string}  [opts.ip]
 * @param {string}  [opts.userAgent]
 * @param {string}  [opts.provider]   — 'local' | 'google'
 * @param {boolean} [opts.success]    — true/false
 * @param {string}  [opts.reason]     — failure reason (e.g. 'invalid_password')
 * @param {Object}  [opts.extra]      — additional metadata
 */
logger.userLog = (action, opts = {}) => {
  const tag = `[USER_${action.toUpperCase()}]`;
  const logData = {
    event: `user_${action}`,
    userId: opts.userId || 'unknown',
    email: opts.email,
    ip: opts.ip,
    userAgent: opts.userAgent,
    provider: opts.provider || 'local',
    success: opts.success !== undefined ? opts.success : true,
    reason: opts.reason,
    timestamp: new Date().toISOString(),
    ...opts.extra,
  };

  // Remove undefined keys for cleaner logs
  Object.keys(logData).forEach((k) => logData[k] === undefined && delete logData[k]);

  if (opts.success === false) {
    logger.warn(`${tag} ${action} failed`, logData);
  } else {
    logger.info(`${tag} ${action} successful`, logData);
  }
};


/**
 * Log product lifecycle events — posted, updated, deleted.
 * Routes to /listify/{env}/products CloudWatch log group.
 *
 * @param {'posted'|'updated'|'deleted'} action
 * @param {string} entity - 'electronics' | 'vehicles' | 'forsale'
 * @param {Object} listing - listing document
 * @param {Object} req - Express request
 * @param {Object} [extra] - additional metadata
 */
logger.productLog = (action, entity, listing, req, extra = {}) => {
  const tag = `[PRODUCT_${action.toUpperCase()}]`;
  const logData = {
    event: `product_${action}`,
    entity,
    listingId: listing._id || listing.id,
    title: listing.title,
    category: listing.category,
    subcategory: listing.subcategory,
    price: listing.price,
    condition: listing.condition,
    location: listing.location,
    imageCount: (listing.images || []).length,
    sellerId: req.user?._id || req.user?.id || 'unknown',
    sellerEmail: req.user?.email || 'unknown',
    ip: req.ip,
    userAgent: req.get ? req.get('user-agent') : 'unknown',
    timestamp: new Date().toISOString(),
    ...extra,
  };

  logger.info(`${tag} ${entity} listing ${action}`, logData);
};


/**
 * Log security events — CSRF blocks, rate limits, suspicious activity.
 * Routes to /listify/{env}/security CloudWatch log group.
 *
 * @param {string} event - e.g. 'csrf_blocked', 'rate_limited', 'bot_blocked'
 * @param {Object} opts
 */
logger.securityLog = (event, opts = {}) => {
  const logData = {
    event: `security_${event}`,
    ip: opts.ip,
    path: opts.path,
    method: opts.method,
    userId: opts.userId,
    userAgent: opts.userAgent,
    reason: opts.reason,
    timestamp: new Date().toISOString(),
    ...opts.extra,
  };

  Object.keys(logData).forEach((k) => logData[k] === undefined && delete logData[k]);

  logger.warn(`[SECURITY] ${event}`, logData);
};


logger.requestLog = (req, res, error = null) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id || 'anonymous',
    statusCode: res.statusCode,
    responseTime: res.get('x-response-time'),
  };

  if (error) {
    logger.error('Request failed', { ...logData, error: error.message });
  } else {
    logger.info('Request completed', logData);
  }
};


logger.dbLog = (operation, collection, query, result, error = null) => {
  const logData = {
    operation,
    collection,
    query: JSON.stringify(query),
    resultCount: Array.isArray(result) ? result.length : result ? 1 : 0,
  };

  if (error) {
    logger.error('Database operation failed', { ...logData, error: error.message });
  } else {
    logger.debug('Database operation completed', logData);
  }
};


logger.emailLog = (action, recipient, status, error = null) => {
  const logData = {
    action,
    recipient, // auto-masked by sanitizer
    status,
    timestamp: new Date().toISOString(),
  };

  if (error) {
    logger.error('Email operation failed', { ...logData, error: error.message });
  } else {
    logger.info('Email operation completed', logData);
  }
};


const flushLogs = () => {
  return new Promise((resolve) => {
    let pending = transports.length;
    if (pending === 0) return resolve();

    transports.forEach((t) => {
      if (typeof t.kthxbye === 'function') {
        // winston-cloudwatch flush method
        t.kthxbye(() => {
          pending--;
          if (pending === 0) resolve();
        });
      } else {
        pending--;
        if (pending === 0) resolve();
      }
    });

    // Safety timeout — don't block shutdown forever
    setTimeout(resolve, 5000);
  });
};

module.exports = { logger, flushLogs };