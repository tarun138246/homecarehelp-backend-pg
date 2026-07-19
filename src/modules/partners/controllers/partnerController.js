const partnerService = require('../services/partnerService');

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
    const { orderId } = req.body;
    const result = await partnerService.confirmPartnerOrder(orderId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
