const bookingRepo = require('../repositories/bookingRepository');
const serviceRepo = require('../../services/repositories/serviceRepository');
const userRepo = require('../../users/repositories/userRepository');
const cashfreeClient = require('../../../common/utils/cashfreeClient');

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

/**
 * Validate and normalize services input
 * Accepts both single service_id string or array of service_ids
 */
function validateAndNormalizeServices(services) {
  if (!services) {
    throw Object.assign(new Error('At least one service is required'), { status: 400 });
  }
  
  // If single service_id string, convert to array
  const serviceArray = Array.isArray(services) ? services : [services];
  
  if (serviceArray.length === 0) {
    throw Object.assign(new Error('At least one service is required'), { status: 400 });
  }
  
  // Remove duplicates
  return [...new Set(serviceArray)];
}

function validateBookingInput(bookingData) {
  const { services, time_slot, payment_option, address, scheduled_date } = bookingData;
  
  const validatedServices = validateAndNormalizeServices(services);
  
  if (!time_slot) throw Object.assign(new Error('time_slot is required'), { status: 400 });
  if (!scheduled_date || isNaN(new Date(scheduled_date).getTime())) {
    throw Object.assign(new Error('scheduled_date is required (a valid date)'), { status: 400 });
  }
  if (!['ONLINE', 'PAY_AT_SERVICE'].includes(payment_option)) {
    throw Object.assign(new Error('payment_option must be ONLINE or PAY_AT_SERVICE'), { status: 400 });
  }
  validateAddress(address);
  
  return validatedServices;
}

function getISTTimestamp() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString();
}

function getPaymentMethod(paymentMethod) {
  if (!paymentMethod) return null;
  if (paymentMethod.upi) return 'UPI';
  if (paymentMethod.netbanking) return 'NET_BANKING';
  if (paymentMethod.card) return 'CARD';
  if (paymentMethod.wallet) return 'WALLET';
  return null;
}

/**
 * Fetch service details for given service IDs
 */
async function getServicesDetails(serviceIds) {
  if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
    return [];
  }
  
  const services = [];
  for (const serviceId of serviceIds) {
    const service = await serviceRepo.findById(serviceId);
    if (service && service.is_active) {
      services.push({
        service_id: service.service_id,
        service_name: service.service_name,
        base_price: parseFloat(service.base_price),
        description: service.description,
        duration: service.duration,
        images: service.images
      });
    }
  }
  return services;
}

exports.createBooking = async (userId, bookingData) => {
  const validatedServices = validateBookingInput(bookingData);

  // Fetch all services from DB and calculate total amount
  let totalAmount = 0;
  const serviceDetails = [];

  for (const serviceId of validatedServices) {
    const service = await serviceRepo.findById(serviceId);
    if (!service || !service.is_active) {
      throw Object.assign(
        new Error(`Service not found or inactive: ${serviceId}`), 
        { status: 404 }
      );
    }
    
    totalAmount += parseFloat(service.base_price);
    serviceDetails.push({
      service_id: service.service_id,
      service_name: service.service_name,
      base_price: parseFloat(service.base_price)
    });
  }

  const isOnline = bookingData.payment_option === 'ONLINE';
  const status = 'payment_pending';
  const payment_status = isOnline ? 'PAY_ONLINE' : 'PAY_AT_SERVICE';

  const booking = await bookingRepo.create({
    user_id: BigInt(userId),
    services_id: validatedServices,  // Store just the service IDs
    total_amount: totalAmount,
    address: bookingData.address,
    scheduled_date: new Date(bookingData.scheduled_date),
    time_slot: bookingData.time_slot,
    payment_status,
    status,
    payment_details: {}
  });

  console.log('[Booking Created]', {
    bookingId: booking.booking_id.toString(),
    userId: userId.toString(),
    serviceCount: validatedServices.length,
    services: validatedServices,
    totalAmount: totalAmount,
    paymentStatus: payment_status,
    timestamp: getISTTimestamp()
  });

  return { 
    booking_id: booking.booking_id.toString(),
    total_amount: totalAmount,
    services: serviceDetails
  };
};

exports.getUserBookings = async (userId) => {
  const bookings = await bookingRepo.findAllByUser(userId);
  
  // Enrich each booking with service details
  const enrichedBookings = [];
  for (const b of bookings) {
    const services = await getServicesDetails(b.services_id || []);
    enrichedBookings.push({
      booking_id: b.booking_id.toString(),
      services: services,
      total_amount: b.total_amount,
      scheduled_date: b.scheduled_date,
      time_slot: b.time_slot,
      status: b.status,
      payment_status: b.payment_status,
      created_at: b.created_at
    });
  }
  
  return enrichedBookings;
};

exports.getBookingDetail = async (userId, bookingId) => {
  const booking = await bookingRepo.findById(bookingId);
  if (!booking || booking.user_id.toString() !== userId.toString()) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  // Fetch service details
  const services = await getServicesDetails(booking.services_id || []);

  return {
    booking_id: booking.booking_id.toString(),
    services: services,
    total_amount: booking.total_amount,
    address: booking.address,
    scheduled_date: booking.scheduled_date,
    time_slot: booking.time_slot,
    payment_status: booking.payment_status,
    payment_details: booking.payment_details,
    status: booking.status,
    created_at: booking.created_at
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

  if (booking.status !== 'payment_pending' && booking.status !== 'payment_initiated' && 
      booking.status !== 'payment_failed' && booking.status !== 'payment_dropped') {
    throw Object.assign(new Error('This booking is not awaiting payment'), { status: 400 });
  }

  if (booking.payment_status !== 'PAY_ONLINE') {
    throw Object.assign(new Error('This booking is set for pay at service, not online payment'), { status: 400 });
  }

  // Re-validate all services are still active and prices haven't changed
  const serviceIds = booking.services_id || [];
  let currentTotal = 0;
  
  for (const serviceId of serviceIds) {
    const service = await serviceRepo.findById(serviceId);
    if (!service || !service.is_active) {
      throw Object.assign(new Error(`Service no longer available: ${serviceId}`), { status: 404 });
    }
    currentTotal += parseFloat(service.base_price);
  }

  // Check if price has changed
  if (parseFloat(booking.total_amount) !== currentTotal) {
    throw Object.assign(new Error('Service prices have changed. Please create a new booking.'), { status: 400 });
  }

  const user = await userRepo.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const istTimestamp = Date.now() + (5.5 * 60 * 60 * 1000);
  const order_id = `${ORDER_PREFIX}_${bookingId}_${istTimestamp}`;

  console.log('[Create Order] Generating Cashfree order:', {
    bookingId: bookingId.toString(),
    orderId: order_id,
    amount: booking.total_amount.toString(),
    customerEmail: user.email,
    timestamp: getISTTimestamp()
  });

  const order = await cashfreeClient.createOrder({
    order_id,
    order_amount: booking.total_amount.toString(),
    order_currency: 'INR',
    customer_details: {
      customer_id: userId.toString(),
      customer_name: user.name,
      customer_email: user.email,
      customer_phone: user.phone_number
    }
  });

  console.log('[Create Order] Cashfree order created:', {
    bookingId: bookingId.toString(),
    orderId: order.order_id,
    paymentSessionId: order.payment_session_id
  });

  const paymentDetails = {
    order_id: order.order_id,
    payment_session_id: order.payment_session_id,
    order_amount: booking.total_amount.toString(),
    order_currency: 'INR',
    created_at: getISTTimestamp(),
    updated_at: getISTTimestamp(),
    status: 'PENDING'
  };

  await bookingRepo.update(bookingId, {
    payment_details: paymentDetails,
    status: 'payment_initiated'
  });

  return {
    booking_id: bookingId.toString(),
    order_id: order.order_id,
    payment_session_id: order.payment_session_id
  };
};

exports.confirmOrder = async (orderId) => {
  if (!orderId) throw Object.assign(new Error('orderId is required'), { status: 400 });

  console.log('[Confirm Order] Checking order:', { orderId });

  const parts = String(orderId).split('_');
  if (parts[0] !== ORDER_PREFIX || !parts[1]) {
    throw Object.assign(new Error('Invalid order ID format'), { status: 400 });
  }

  const bookingId = parts[1];
  const booking = await bookingRepo.findById(bookingId);
  
  if (!booking) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  console.log('[Confirm Order] Booking found:', {
    bookingId: bookingId.toString(),
    paymentStatus: booking.payment_status,
    currentStatus: booking.status
  });

  // Pay at service - instantly confirm
  if (booking.payment_status === 'PAY_AT_SERVICE') {
    await bookingRepo.update(bookingId, { status: 'booked' });
    return { 
      paid: true, 
      message: 'Booking confirmed (Pay at Service)', 
      booking_id: bookingId.toString() 
    };
  }

  // Online payment - check payment_details status
  if (booking.payment_status === 'PAY_ONLINE') {
    const paymentDetails = booking.payment_details || {};

    if (paymentDetails.order_id !== orderId) {
      return { 
        paid: false, 
        message: 'Order ID mismatch', 
        booking_id: bookingId.toString(),
        order_status: 'MISMATCH'
      };
    }

    if (paymentDetails.status === 'SUCCESS') {
      await bookingRepo.update(bookingId, { status: 'booked' });
      return { 
        paid: true, 
        message: 'Booking confirmed (Online Payment)', 
        booking_id: bookingId.toString() 
      };
    } else {
      return { 
        paid: false, 
        message: `Payment status is ${paymentDetails.status}`, 
        booking_id: bookingId.toString(),
        order_status: paymentDetails.status
      };
    }
  }

  throw Object.assign(new Error('Invalid payment status'), { status: 400 });
};

exports.processWebhook = async (webhookData) => {
  const { type, data } = webhookData;
  
  console.log('[Booking Webhook] Processing:', {
    type,
    orderId: data?.order?.order_id,
    timestamp: getISTTimestamp()
  });
  
  if (!data?.order?.order_id) {
    console.error('[Booking Webhook] Invalid webhook data - missing order_id');
    throw Object.assign(new Error('Invalid webhook data'), { status: 400 });
  }

  const orderId = data.order.order_id;
  const order = data.order;
  const payment = data.payment;
  
  const parts = String(orderId).split('_');
  if (parts[0] !== ORDER_PREFIX || !parts[1]) {
    throw Object.assign(new Error('Invalid order ID format for bookings'), { status: 400 });
  }

  const bookingId = parts[1];
  const booking = await bookingRepo.findById(bookingId);
  
  if (!booking) {
    console.error('[Booking Webhook] Booking not found:', { bookingId, orderId });
    throw Object.assign(new Error('Booking not found for this order'), { status: 404 });
  }

  console.log('[Booking Webhook] Booking found:', {
    bookingId: bookingId.toString(),
    currentStatus: booking.status,
    paymentStatus: booking.payment_status
  });

  switch (type) {
    case 'PAYMENT_SUCCESS_WEBHOOK':
      if (booking.payment_details?.payment_id === payment?.cf_payment_id?.toString() &&
          booking.payment_details?.payment_status === 'SUCCESS') {
        console.log('[Booking Webhook] Already processed (idempotent):', {
          bookingId: bookingId.toString(),
          paymentId: payment?.cf_payment_id
        });
        return { success: true, message: 'Payment already processed', idempotent: true };
      }

      const paymentDetails = {
        order_id: orderId,
        order_amount: order.order_amount?.toString(),
        order_currency: order.order_currency || 'INR',
        payment_id: payment?.cf_payment_id?.toString() || null,
        payment_status: 'SUCCESS',
        status: 'SUCCESS',
        payment_time: payment?.payment_time || null,
        payment_method: getPaymentMethod(payment?.payment_method),
        upi_id: payment?.payment_method?.upi?.upi_id || null,
        bank_reference: payment?.bank_reference || null,
        payment_message: payment?.payment_message || null,
        created_at: booking.payment_details?.created_at || getISTTimestamp(),
        updated_at: getISTTimestamp()
      };
      
      await bookingRepo.update(bookingId, {
        status: 'booked',
        payment_details: paymentDetails
      });
      
      console.log('[Booking Webhook] ✅ Payment success processed:', {
        bookingId: bookingId.toString(),
        orderId,
        paymentId: payment?.cf_payment_id
      });
      
      return { success: true, message: 'Payment confirmed', booking_id: bookingId.toString() };
    
    case 'PAYMENT_FAILED_WEBHOOK':
      if (booking.payment_details?.payment_id === payment?.cf_payment_id?.toString() &&
          booking.payment_details?.payment_status === 'FAILED') {
        return { success: true, message: 'Payment failed status already recorded' };
      }

      await bookingRepo.update(bookingId, {
        status: 'payment_failed',
        payment_details: {
          order_id: orderId,
          order_amount: order.order_amount?.toString(),
          order_currency: order.order_currency || 'INR',
          payment_id: payment?.cf_payment_id?.toString() || null,
          payment_status: 'FAILED',
          status: 'FAILED',
          payment_time: payment?.payment_time || null,
          payment_message: payment?.payment_message || null,
          created_at: booking.payment_details?.created_at || getISTTimestamp(),
          updated_at: getISTTimestamp()
        }
      });
      
      return { success: true, message: 'Payment failure recorded' };
    
    case 'PAYMENT_USER_DROPPED_WEBHOOK':
      if (booking.payment_details?.payment_id === payment?.cf_payment_id?.toString() &&
          booking.payment_details?.payment_status === 'USER_DROPPED') {
        return { success: true, message: 'Payment dropped status already recorded' };
      }

      await bookingRepo.update(bookingId, {
        status: 'payment_dropped',
        payment_details: {
          order_id: orderId,
          order_amount: order.order_amount?.toString(),
          order_currency: order.order_currency || 'INR',
          payment_id: payment?.cf_payment_id?.toString() || null,
          payment_status: 'USER_DROPPED',
          status: 'USER_DROPPED',
          payment_time: payment?.payment_time || null,
          created_at: booking.payment_details?.created_at || getISTTimestamp(),
          updated_at: getISTTimestamp()
        }
      });
      
      return { success: true, message: 'Payment dropped recorded' };
    
    default:
      console.error('[Booking Webhook] Unsupported webhook type:', { type });
      throw Object.assign(new Error('Unsupported webhook type'), { status: 400 });
  }
};