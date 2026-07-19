const router = require('express').Router();
const auth = require('../../../common/middlewares/auth');
const paymentController = require('../controllers/paymentController');

// Mounted at /api directly (not /api/bookings) — matches the spec's
// top-level POST /api/create-order and POST /api/confirm-order.
router.post('/create-order', auth, paymentController.createOrder);
router.post('/confirm-order', paymentController.confirmOrder);

module.exports = router;
