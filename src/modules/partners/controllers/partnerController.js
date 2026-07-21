const partnerService = require('../services/partnerService');
const { verifyWebhookSignature } = require('../../../common/utils/webhookVerification');
const logger = require('../../../common/utils/logger');

exports.register = async (req, res, next) => {
  try {
    const partner = await partnerService.register(req.body);
    res.status(201).json(partner);
  } catch (err) {
    next(err);
  }
};

exports.eSign = async (req, res, next) => {
  try {
    const { partnerId, signature } = req.body;
    const result = await partnerService.eSign(partnerId, signature);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    const { partner_id } = req.body;
    const order = await partnerService.createPartnerOrder(partner_id);
    res.json(order);
  } catch (err) {
    next(err);
  }
};

exports.confirmOrder = async (req, res, next) => {
  try {
    const { orderId } = req.query;
    const result = await partnerService.confirmPartnerOrder(orderId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.verifyAgreement = async (req, res, next) => {
  try {
    const { agreementId } = req.params;
    const result = await partnerService.verifyAgreement(agreementId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.webhook = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    // Extract webhook signature headers
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];

    // Log webhook receipt
    logger.webhook('Received', {
      timestamp: new Date().toISOString(),
      signature: signature ? 'present' : 'missing',
      timestampHeader: timestamp,
      bodyLength: req.rawBody?.length || 0,
      userAgent: req.headers['user-agent']
    });

    // Verify webhook signature (throws on failure)
    verifyWebhookSignature(req.rawBody, signature, timestamp);

    logger.webhook('Signature verified successfully', { timestamp });

    // Parse webhook data (already parsed in app.js but validate)
    const webhookData = req.body;
    
    if (!webhookData || !webhookData.type || !webhookData.data) {
      throw Object.assign(
        new Error('Invalid webhook payload structure'),
        { status: 400 }
      );
    }

    logger.webhook('Validated payload', {
      type: webhookData.type,
      orderId: webhookData.data?.order?.order_id
    });

    // Respond immediately with 200 OK (Cashfree requirement)
    res.status(200).json({ 
      success: true, 
      message: 'Webhook received and queued for processing',
      receivedAt: new Date().toISOString()
    });

    // Process webhook asynchronously (don't await)
    partnerService.processWebhook(webhookData)
      .then(result => {
        const duration = Date.now() - startTime;
        logger.webhook('Processing completed successfully', {
          duration: `${duration}ms`,
          type: webhookData.type,
          orderId: webhookData.data?.order?.order_id,
          result
        });
      })
      .catch(err => {
        const duration = Date.now() - startTime;
        logger.webhookError('Processing failed', err, {
          duration: `${duration}ms`,
          type: webhookData.type,
          orderId: webhookData.data?.order?.order_id
        });
      });

  } catch (err) {
    // Signature verification or validation errors - respond with error
    const duration = Date.now() - startTime;
    logger.webhookError('Validation error', err, {
      duration: `${duration}ms`,
      status: err.status || 500
    });
    next(err);
  }
};
