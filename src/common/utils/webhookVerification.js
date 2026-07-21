const crypto = require('crypto');
const env = require('../config/env');

/**
 * Verifies Cashfree webhook signature using HMAC-SHA256
 * @param {string} rawBody - The raw request body as string
 * @param {string} signature - The x-webhook-signature header value
 * @param {string} timestamp - The x-webhook-timestamp header value
 * @returns {boolean} - True if signature is valid
 * @throws {Error} - If signature is invalid or timestamp is too old
 */
function verifyWebhookSignature(rawBody, signature, timestamp) {
  if (!rawBody || !signature || !timestamp) {
    throw Object.assign(
      new Error('Missing required webhook verification parameters'),
      { status: 400 }
    );
  }

  // Reject webhooks older than 5 minutes (replay attack protection)
  const webhookAge = Date.now() - parseInt(timestamp) * 1000;
  const MAX_AGE = 5 * 60 * 1000; // 5 minutes

  if (webhookAge > MAX_AGE) {
    throw Object.assign(
      new Error(`Webhook timestamp too old: ${Math.floor(webhookAge / 1000)}s`),
      { status: 401 }
    );
  }

  if (webhookAge < -60000) {
    // Timestamp is more than 1 minute in the future
    throw Object.assign(
      new Error('Webhook timestamp is in the future'),
      { status: 401 }
    );
  }

  // Compute HMAC-SHA256 signature
  const signatureString = rawBody + timestamp;
  const computedSignature = crypto
    .createHmac('sha256', env.cashfreeClientSecret)
    .update(signatureString)
    .digest('base64');

  const isValid = computedSignature === signature;

  if (!isValid) {
    throw Object.assign(
      new Error('Invalid webhook signature - possible forgery attempt'),
      { status: 401 }
    );
  }

  return true;
}

module.exports = { verifyWebhookSignature };
