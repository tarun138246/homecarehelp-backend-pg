const bookingRepo = require('../repositories/bookingRepository');
const serviceRepo = require('../../services/repositories/serviceRepository');
const userRepo = require('../../users/repositories/userRepository');
const cashfreePaymentService = require('../../payments/services/cashfreePaymentService');

const CANCELLATION_WINDOW_HOURS = 24;
const ORDER_PREFIX = 'bkg';
const VALID_ADDRESS_TYPES = ['home', 'work'];
const REQUIRED_ADDRESS_FIELDS = ['city', 'landmark', 'pincode', 'state', 'street', 'type'];

function validateAddress(address) {
  if (!address || typeof address !== 'object') {
    throw Object.assign(new Error('Address is required'), { status: 400 });
  }
  for (const field of REQUIRED_ADDRESS_FIELDS) {
    if (!address[field] || typeof address[field] !== 'string' || !address[field].trim()) {
      throw Object.assign(new Error(`Address field "${field}" is required`), { status: 400 });
    }
  }
  if (!VALID_ADDRESS_TYPES.includes(address.type)) {
    throw Object.assign(new Error('Address type must be "home" or "work"'), { status: 400 });
  }
}

function validateBookingInput(bookingData) {
  const { service_id, service_price, time_slot, payment_option, address, scheduled_date } = bookingData;
  if (!service_id) throw Object.assign(new Error('service_id is required'), { status: 400 });
  if (service_price === undefined || service_price === null || isNaN(parseFloat(service_price))) {
    throw Object.assign(new Error('service_price is required'), { status: 400 });
  }
  if (!time_slot) throw Object.assign(new Error('time_slot is required'), { status: 400 });
  if (!scheduled_date || isNaN(new Date(scheduled_date).getTime())) {
    throw Object.assign(new Error('scheduled_date is required (a valid date)'), { status: 400 });
  }
  if (!['ONLINE', 'PAY_AT_SERVICE'].includes(payment_option)) {
    throw Object.assign(new Error('payment_option must be ONLINE or PAY_AT_SERVICE'), { status: 400 });
  }
  validateAddress(address);
}

exports.createBooking = async (userId, bookingData) => {
  validateBookingInput(bookingData);

  const service = await serviceRepo.findById(bookingData.service_id);
  if (!service || !service.is_active) {
    throw Object.assign(new Error('Service not found'), { status: 404 });
  }

  // base_price is the only field ever checked against, regardless of pricing_type.
  if (service.base_price === null || parseFloat(bookingData.service_price) !== parseFloat(service.base_price)) {
    throw Object.assign(new Error('Price mismatch — service price does not match the current base price'), { status: 400 });
  }

  const isOnline = bookingData.payment_option === 'ONLINE';
  const status = isOnline ? 'payment_pending' : 'booked';
  const payment_status = isOnline ? 'payment_pending' : 'pending';

  const booking = await bookingRepo.create({
    user_id: BigInt(userId),
    service_id: bookingData.service_id,
    service_price: bookingData.service_price,
    address: bookingData.address,
    scheduled_date: new Date(bookingData.scheduled_date),
    time_slot: bookingData.time_slot,
    payment_option: bookingData.payment_option,
    payment_status,
    status
  });

  // ONLINE returns only the booking_id — the Cashfree order is created
  // separately via POST /api/create-order.
  return { booking_id: booking.booking_id.toString() };
};

exports.getUserBookings = async (userId) => {
  const bookings = await bookingRepo.findAllByUser(userId);
  return bookings.map((b) => ({
    booking_id: b.booking_id.toString(),
    service_name: b.services?.service_name ?? null,
    price: b.service_price,
    scheduled_date: b.scheduled_date,
    time_slot: b.time_slot
  }));
};

exports.getBookingDetail = async (userId, bookingId) => {
  const booking = await bookingRepo.findByIdWithService(bookingId);
  if (!booking || booking.user_id.toString() !== userId.toString()) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  const { user_id, users, services, ...rest } = booking;
  return {
    ...rest,
    booking_id: rest.booking_id.toString(),
    service_name: services?.service_name ?? null
  };
};

exports.cancelBooking = async (userId, bookingId) => {
  const booking = await bookingRepo.findById(bookingId);
  if (!booking || booking.user_id.toString() !== userId.toString()) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }
  if (booking.status === 'cancelled') {
    throw Object.assign(new Error('Booking is already cancelled'), { status: 400 });
  }

  const elapsedHours = (Date.now() - new Date(booking.created_at).getTime()) / (1000 * 60 * 60);
  if (elapsedHours >= CANCELLATION_WINDOW_HOURS) {
    throw Object.assign(new Error('Cancellation window has passed'), { status: 400 });
  }

  await bookingRepo.update(bookingId, { status: 'cancelled' });
  return { message: 'Booking cancelled' };
};

exports.createOrder = async (userId, bookingId) => {
  if (!bookingId) throw Object.assign(new Error('bookingId is required'), { status: 400 });

  const booking = await bookingRepo.findById(bookingId);
  if (!booking || booking.user_id.toString() !== userId.toString()) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }
  if (booking.status !== 'payment_pending') {
    throw Object.assign(new Error('This booking is not awaiting online payment'), { status: 400 });
  }

  const user = await userRepo.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  // Amount is always recalculated server-side from the stored booking, never
  // trusted from the client.
  const order = await cashfreePaymentService.createOrder({
    prefix: ORDER_PREFIX,
    entityId: bookingId.toString(),
    amount: booking.service_price,
    customerName: user.name,
    customerEmail: user.email,
    customerPhone: user.phone_number
  });

  return order;
};

exports.confirmOrder = async (orderId) => {
  if (!orderId) throw Object.assign(new Error('orderId is required'), { status: 400 });

  const result = await cashfreePaymentService.confirmOrder({ orderId, expectedPrefix: ORDER_PREFIX });

  if (result.order_status !== 'PAID') {
    return { paid: false, order_status: result.order_status };
  }

  const booking = await bookingRepo.findById(result.entityId);
  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  await bookingRepo.update(result.entityId, {
    status: 'booked',
    payment_status: 'paid',
    payment_details: {
      order_id: result.order_id,
      payment_session_id: result.payment_session_id,
      amount: result.order_amount,
      paidAt: new Date().toISOString()
    }
  });

  return { paid: true, message: 'Booking confirmed', booking_id: result.entityId };
};
