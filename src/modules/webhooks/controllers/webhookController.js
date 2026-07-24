const { handleCashfreeWebhook } = require('../../../common/utils/webhookConfirmation');
const { routeWebhook } = require('../../../common/utils/webhookRouter');

/**
 * Single unified webhook endpoint for all Cashfree webhooks
 * Automatically routes to booking or partner service based on order_id prefix
 */
exports.cashfreeWebhook = async (req, res, next) => {
  try {
    await handleCashfreeWebhook(req, res, async (webhookData) => {
      // routeWebhook determines if it's a booking (bkg_) or partner (ptn_) webhook
      return await routeWebhook(webhookData);
    });
  } catch (err) {
    next(err);
  }
};