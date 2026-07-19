const prisma = require('../../../common/prismaClient');

exports.create = (data) => {
  return prisma.bookings.create({ data });
};

// Plain fetch, no relations — used for ownership/status checks and anywhere
// the caller must not risk leaking the joined user's password hash.
exports.findById = (booking_id) => {
  return prisma.bookings.findUnique({ where: { booking_id: BigInt(booking_id) } });
};

exports.findByIdWithService = (booking_id) => {
  return prisma.bookings.findUnique({
    where: { booking_id: BigInt(booking_id) },
    include: { services: { select: { service_name: true } } }
  });
};

exports.findAllByUser = (user_id) => {
  return prisma.bookings.findMany({
    where: { user_id: BigInt(user_id) },
    include: { services: { select: { service_name: true } } },
    orderBy: { created_at: 'desc' }
  });
};

exports.update = (booking_id, data) => {
  return prisma.bookings.update({
    where: { booking_id: BigInt(booking_id) },
    data
  });
};
