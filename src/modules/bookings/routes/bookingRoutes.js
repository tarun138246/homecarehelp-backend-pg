const router = require('express').Router();
const auth = require('../../../common/middlewares/auth');
const bookingController = require('../controllers/bookingController');

router.post('/', auth, bookingController.createBooking);
router.get('/', auth, bookingController.getUserBookings);
router.get('/:id', auth, bookingController.getBookingById);
router.post('/cancel/:bookingId', auth, bookingController.cancelBooking);

router.post('/create-order', auth, bookingController.createOrder);
router.post('/confirm-order', bookingController.confirmOrder);

module.exports = router;