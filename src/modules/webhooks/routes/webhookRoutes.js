const router = require('express').Router();
const webhookController = require('../controllers/webhookController');

// Single unified webhook endpoint
// Handles both booking (bkg_) and partner (ptn_) webhooks
router.post('/confirm-order-wb', webhookController.cashfreeWebhook);

module.exports = router;