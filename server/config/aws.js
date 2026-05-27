const { S3Client } = require('@aws-sdk/client-s3');
const { logger } = require('../utils/logger');

let s3Client = null;


if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION) {
  logger.warn('AWS credentials not configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION). S3 uploads will fail.');
} else {
  // Create S3 client
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    maxAttempts: 3,
  });

  // Test S3 connection on startup (non-blocking — don't kill the server)
  (async () => {
    try {
      await s3Client.config.credentials();
      logger.info('AWS S3 configured successfully', { region: process.env.AWS_REGION, bucket: process.env.AWS_S3_BUCKET_NAME });
    } catch (error) {
      logger.error('AWS S3 configuration check failed (non-fatal)', { error: error.message });
    }
  })();
}

module.exports = { s3Client };