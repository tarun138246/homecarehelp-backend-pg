const { verifyWebhookSignature } = require('./webhookVerification');
const logger = require('./logger');

/**
 * Universal webhook handler for Cashfree payment confirmations
 * Works for both bookings and partners modules
 * 
 * Usage:
 * 
 * // In partnerController.js
 * exports.webhook = async (req, res, next) => {
 *   try {
 *     await handleCashfreeWebhook(req, res, async (webhookData) => {
 *       return await partnerService.processWebhook(webhookData);
 *     });
 *   } catch (err) {
 *     next(err);
 *   }
 * };
 * 
 * // In bookingController.js
 * exports.webhook = async (req, res, next) => {
 *   try {
 *     await handleCashfreeWebhook(req, res, async (webhookData) => {
 *       return await bookingService.processWebhook(webhookData);
 *     });
 *   } catch (err) {
 *     next(err);
 *   }
 * };
 * 
 * @param {Object} req - Express request object (must have rawBody for signature verification)
 * @param {Object} res - Express response object
 * @param {Function} processCallback - Callback function to process the webhook data
 *                                     Receives (webhookData) and should return result
 * @returns {Object} { success: true, message: 'Webhook accepted for processing' }
 */
async function handleCashfreeWebhook(req, res, processCallback) {
  const startTime = Date.now();

  try {
    // Extract webhook signature headers (case-insensitive)
    const signature = req.headers['x-webhook-signature'] 
      || req.headers['X-Webhook-Signature'];
    const timestamp = req.headers['x-webhook-timestamp'] 
      || req.headers['X-Webhook-Timestamp'];

    logger.webhook('Webhook received', {
      timestamp: new Date().toISOString(),
      signature: signature ? 'present' : 'missing',
      timestampHeader: timestamp || 'missing',
      bodyLength: req.rawBody?.length || 0,
      type: req.body?.type
    });

    // Step 1: Verify webhook signature using existing webhookVerification utility
    // This will throw if verification fails
    verifyWebhookSignature(req.rawBody, signature, timestamp);

    // Step 2: Parse webhook data
    const webhookData = req.body;
    
    if (!webhookData || !webhookData.type || !webhookData.data) {
      throw Object.assign(
        new Error('Invalid webhook payload structure'),
        { status: 400 }
      );
    }

    // Validate webhook type is one we support
    const validTypes = [
      'PAYMENT_SUCCESS_WEBHOOK',
      'PAYMENT_FAILED_WEBHOOK',
      'PAYMENT_USER_DROPPED_WEBHOOK'
    ];

    if (!validTypes.includes(webhookData.type)) {
      logger.webhook('Unsupported webhook type received', {
        type: webhookData.type,
        orderId: webhookData.data?.order?.order_id
      });
      
      // Still return 200 to Cashfree to acknowledge receipt
      // But don't process further
      return res.status(200).json({
        success: true,
        message: 'Webhook received but type not supported',
        receivedAt: new Date().toISOString()
      });
    }

    logger.webhook('Webhook validated successfully', {
      type: webhookData.type,
      orderId: webhookData.data?.order?.order_id
    });

    // Step 3: Respond immediately with 200 OK (Cashfree requirement)
    res.status(200).json({ 
      success: true, 
      message: 'Webhook received',
      receivedAt: new Date().toISOString()
    });

    // Step 4: Process asynchronously (don't block the response)
    processCallback(webhookData)
      .then(result => {
        const duration = Date.now() - startTime;
        logger.webhook('Webhook processing completed successfully', {
          duration: `${duration}ms`,
          type: webhookData.type,
          orderId: webhookData.data?.order?.order_id,
          result
        });
      })
      .catch(err => {
        const duration = Date.now() - startTime;
        logger.webhookError('Webhook processing failed', err, {
          duration: `${duration}ms`,
          type: webhookData.type,
          orderId: webhookData.data?.order?.order_id
        });
        
        // Log the full error for debugging
        console.error('[Webhook Processing Error]', {
          type: webhookData.type,
          orderId: webhookData.data?.order?.order_id,
          error: err.message,
          stack: err.stack
        });
      });

    // Return for controller to know it was accepted
    return { 
      success: true, 
      message: 'Webhook accepted for processing',
      type: webhookData.type
    };

  } catch (err) {
    const duration = Date.now() - startTime;
    
    // Log the verification failure
    logger.webhookError('Webhook verification failed', err, {
      duration: `${duration}ms`,
      status: err.status || 500,
      hasSignature: !!req.headers['x-webhook-signature'] || !!req.headers['X-Webhook-Signature'],
      hasTimestamp: !!req.headers['x-webhook-timestamp'] || !!req.headers['X-Webhook-Timestamp'],
      hasRawBody: !!req.rawBody
    });

    // Rethrow to let the controller's error handler deal with it
    throw err;
  }
}

module.exports = { handleCashfreeWebhook };