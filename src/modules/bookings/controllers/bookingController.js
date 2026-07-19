const bookingService = require('../services/bookingService');

exports.createBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.createBooking(req.user.userId, req.body);
    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
};

exports.getUserBookings = async (req, res, next) => {
  try {
    const bookings = await bookingService.getUserBookings(req.user.userId);
    res.json(bookings);
  } catch (err) {
    next(err);
  }
};

exports.getBookingDetail = async (req, res, next) => {
  try {
    const booking = await bookingService.getBookingDetail(req.user.userId, req.params.bookingId);
    res.json(booking);
  } catch (err) {
    next(err);
  }
};

exports.cancelBooking = async (req, res, next) => {
  try {
    const result = await bookingService.cancelBooking(req.user.userId, req.params.bookingId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
