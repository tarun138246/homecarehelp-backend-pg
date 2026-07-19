const bookingService = require('../services/bookingService');

// POST /api/create-order — auth required, body: { bookingId }
exports.createOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const order = await bookingService.createOrder(req.user.userId, bookingId);
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// POST /api/confirm-order — no auth (Cashfree redirect), body: { orderId }
exports.confirmOrder = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const result = await bookingService.confirmOrder(orderId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
