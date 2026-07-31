const prisma = require('../../../common/prismaClient');

exports.findAllBookings = () => {
  return prisma.bookings.findMany({
    select: {
      total_amount: true,
      address: true,
      users: {
        select: {
          name: true,
          phone_number: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });
};

exports.findBookingById = (bookingId) => {
  return prisma.bookings.findUnique({
    where: { booking_id: BigInt(bookingId) },
    select: {
      booking_id: true,
      total_amount: true,
      address: true,
      users: {
        select: {
          name: true,
          phone_number: true,
        },
      },
    },
  });
};