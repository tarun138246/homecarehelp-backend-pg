const router = require('express').Router();
const adminController = require('../controllers/adminController');

// Placeholder module — every route responds 501 until admin login,
// bookings view, accept/reject, and partner-onboarding-view are built.
router.all('*', adminController.notImplemented);

module.exports = router;
