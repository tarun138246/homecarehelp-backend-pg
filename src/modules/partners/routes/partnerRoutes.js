const router = require('express').Router();
const partnerController = require('../controllers/partnerController');

// Middleware to capture raw body for webhook
const rawBodyMiddleware = (req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      req.rawBody = data;
      next();
    });
  } else {
    next();
  }
};

router.post('/register', partnerController.register);
router.post('/e-sign', partnerController.eSign);
router.post('/create-order', partnerController.createOrder);
router.get('/confirm-order', partnerController.confirmOrder);
router.get('/verify-agreement/:agreementId', partnerController.verifyAgreement);
router.post('/confirm-order-wb', rawBodyMiddleware, partnerController.webhook);

module.exports = router;