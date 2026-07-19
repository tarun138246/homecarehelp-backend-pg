const router = require('express').Router();
const partnerController = require('../controllers/partnerController');

router.post('/register', partnerController.register);
router.post('/e-sign', partnerController.eSign);
router.post('/create-order', partnerController.createOrder);
router.post('/confirm-order', partnerController.confirmOrder);
router.get('/verify-agreement/:agreementId', partnerController.verifyAgreement);

module.exports = router;
