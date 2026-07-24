const partnerService = require('../services/partnerService');
const { handleCashfreeWebhook } = require('../../../common/utils/webhookConfirmation');

exports.register = async (req, res, next) => {
  try {
    const result = await partnerService.register(req.body);
    
    const statusCode = result.isUpdate ? 200 : 201;
    res.status(statusCode).json({
      success: true,
      ...result
    });
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

// Fallback webhook for partner - uses the same unified handler
exports.webhook = async (req, res, next) => {
  try {
    await handleCashfreeWebhook(req, res, async (webhookData) => {
      // Always route to partner service for this fallback endpoint
      return await partnerService.processWebhook(webhookData);
    });
  } catch (err) {
    next(err);
  }
};