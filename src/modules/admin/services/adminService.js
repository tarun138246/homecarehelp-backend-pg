const crypto = require('crypto');
const prisma = require('../../../common/prismaClient');
const env = require('../../../common/config/env');
const { signToken } = require('../../../common/utils/jwt');

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

  // Timing-safe comparison of both email and password
  if (!timingSafeEqual(email, configuredEmail)) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }
  if (!timingSafeEqual(password, configuredPassword)) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const token = signToken({ email, type: 'superadmin' });
  return { token, email };
}

/**
 * Fetch all bookings and return only name, phone number, total booking amount, and address
 */
async function getAllBookings() {
  const bookings = await prisma.bookings.findMany({
    select: {
      booking_id: true,
      total_amount: true,
      address: true,
      users: {
        select: {
          name: true,
          phone_number: true
        }
      }
    },
    orderBy: { created_at: 'desc' }
  });

  // Transform to the exact required output shape
  const result = bookings.map(booking => ({
    booking_id: booking.booking_id,
    name: booking.users.name,
    phone_number: booking.users.phone_number,
    total_amount: booking.total_amount.toString(),
    address: booking.address
  }));

  return result;
}

module.exports = { authenticateSuperAdmin, getAllBookings };