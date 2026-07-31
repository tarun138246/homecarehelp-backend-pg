const router = require('express').Router();
const controller = require('../controllers/adminController');
const superAdminAuth = require('../../../common/middlewares/superAdminAuth');
const { authLimiter } = require('../../../common/middlewares/rateLimiter');

router.post('/login', authLimiter, controller.login);
router.get('/bookings', superAdminAuth, controller.getBookings);     
router.get('/booking/:id', superAdminAuth, controller.getBookingById);   

module.exports = router;