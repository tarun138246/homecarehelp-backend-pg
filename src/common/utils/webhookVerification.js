const crypto = require('crypto');
const env = require('../config/env');

/**
 * Verify Cashfree webhook signature
 * Per Cashfree docs:
 * 1. Extract x-webhook-timestamp from headers
 * 2. Concatenate timestamp + rawBody
 * 3. Generate HMAC-SHA256 with client secret
 * 4. Base64 encode the hash
 * 5. Compare with x-webhook-signature header
 */
function verifyWebhookSignature(rawBody, signature, timestamp) {
  // In sandbox mode, accept webhooks without strict verification
  // But still verify if signature is present
  if (env.cashfreeEnv === 'SANDBOX') {
    if (!signature) {
      console.log('[Webhook Sandbox] No signature - accepting webhook');
      return true;
    }
  }

  // Production: signature is required
  if (!signature && env.cashfreeEnv !== 'SANDBOX') {
    throw Object.assign(
      new Error('Missing x-webhook-signature header'),
      { status: 401 }
    );
  }

  if (!rawBody) {
    throw Object.assign(
      new Error('Missing raw request body'),
      { status: 400 }
    );
  }

  if (!timestamp) {
    throw Object.assign(
      new Error('Missing x-webhook-timestamp header'),
      { status: 400 }
    );
  }

  try {
    const clientSecret = env.cashfreeClientSecret;
    
    if (!clientSecret) {
      throw Object.assign(
        new Error('Cashfree client secret not configured'),
        { status: 500 }
      );
    }

    // Per Cashfree docs: timestamp + rawBody
    const signStr = timestamp + rawBody;
    
    // Generate HMAC-SHA256 and Base64 encode
    const computedSignature = crypto
      .createHmac('sha256', clientSecret)
      .update(signStr)
      .digest('base64');

    // Use timing-safe comparison to prevent timing attacks
    const receivedBuffer = Buffer.from(signature);
    const computedBuffer = Buffer.from(computedSignature);

    if (receivedBuffer.length !== computedBuffer.length) {
      console.error('[Webhook] Signature length mismatch:', {
        received: receivedBuffer.length,
        computed: computedBuffer.length
      });
      throw Object.assign(
        new Error('Webhook signature verification failed'),
        { status: 401 }
      );
    }

    const isValid = crypto.timingSafeEqual(receivedBuffer, computedBuffer);

    if (!isValid) {
      // Log first few chars for debugging (never log full signature in production)
      console.error('[Webhook] Signature mismatch:', {
        received: signature.substring(0, 20) + '...',
        computed: computedSignature.substring(0, 20) + '...',
        timestamp,
        bodyLength: rawBody.length,
        signStrLength: signStr.length
      });
      
      throw Object.assign(
        new Error('Webhook signature verification failed - possible forgery'),
        { status: 401 }
      );
    }

    console.log('[Webhook] Signature verified successfully');
    return true;

  } catch (err) {
    // Re-throw if already our custom error
    if (err.status) throw err;
    
    // Wrap unexpected errors
    throw Object.assign(
      new Error('Webhook verification error: ' + err.message),
      { status: 500 }
    );
  }
}

module.exports = { verifyWebhookSignature };