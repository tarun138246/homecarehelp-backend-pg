const router = require('express').Router();
const auth = require('../../../common/middlewares/auth');
const bookingController = require('../controllers/bookingController');

router.post('/', auth, bookingController.createBooking);
router.get('/', auth, bookingController.getUserBookings);
router.post('/cancel/:bookingId', auth, bookingController.cancelBooking);
router.get('/:bookingId', auth, bookingController.getBookingDetail);

module.exports = router;
