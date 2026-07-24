const prisma = require('../../../common/prismaClient');

exports.create = (data) => {
  return prisma.bookings.create({ data });
};

exports.findById = (booking_id) => {
  return prisma.bookings.findUnique({ 
    where: { booking_id: BigInt(booking_id) } 
  });
};

exports.findAllByUser = (user_id) => {
  return prisma.bookings.findMany({
    where: { user_id: BigInt(user_id) },
    orderBy: { created_at: 'desc' }
  });
};

exports.update = (booking_id, data) => {
  return prisma.bookings.update({
    where: { booking_id: BigInt(booking_id) },
    data
  });
};

exports.findByOrderId = (orderId) => {
  return prisma.bookings.findFirst({
    where: {
      payment_details: {
        path: ['order_id'],
        equals: orderId
      }
    }
  });
};