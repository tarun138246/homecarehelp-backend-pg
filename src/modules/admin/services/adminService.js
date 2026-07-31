const crypto = require('crypto');
const { signToken } = require('../../../common/utils/jwt');
const adminRepo = require('../repositories/adminRepository');

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Authenticate superadmin using environment‑stored credentials
 */
async function authenticateSuperAdmin(email, password) {
  const configuredEmail = process.env.SUPERADMIN_EMAIL;
  const configuredPassword = process.env.SUPERADMIN_PASSWORD;

  if (!configuredEmail || !configuredPassword) {
    throw Object.assign(new Error('Superadmin not configured'), { status: 500 });
  }

  // 🔐 Always evaluate both comparisons – no short‑circuit
  const emailMatch = timingSafeEqual(email, configuredEmail);
  const passwordMatch = timingSafeEqual(password, configuredPassword);

  if (!emailMatch || !passwordMatch) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const token = signToken({ email, type: 'superadmin' });
  return { token, email };
}

/**
 * Helper: validate BigInt before converting (optional but safe)
 */
function toBigIntOrThrow(str, fieldName) {
  try {
    return BigInt(str);
  } catch {
    throw Object.assign(new Error(`${fieldName} must be a valid integer`), { status: 400 });
  }
}

/**
 * Fetch all bookings – simplified list (name, phone, total_amount, address)
 */
async function getAllBookings() {
  const bookings = await adminRepo.findAllBookings();

  return bookings.map((b) => ({
    name: b.users.name,
    phone_number: b.users.phone_number,
    total_amount: b.total_amount.toString(),
    address: b.address,
  }));
}

/**
 * Fetch a single booking by ID – full detail (booking_id, name, phone, total_amount, address)
 */
async function getBookingById(id) {
  // Optional validation – converts safely and returns 400 on garbage input
  const bookingId = toBigIntOrThrow(id, 'Booking ID');

  const booking = await adminRepo.findBookingById(bookingId);

  if (!booking) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  return {
    booking_id: booking.booking_id.toString(),  // keep consistent string representation
    name: booking.users.name,
    phone_number: booking.users.phone_number,
    total_amount: booking.total_amount.toString(),
    address: booking.address,
  };
}

module.exports = { authenticateSuperAdmin, getAllBookings, getBookingById };