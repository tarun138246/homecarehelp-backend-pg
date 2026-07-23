const prisma = require('../../../common/prismaClient');

exports.create = (data) => {
  return prisma.partners.create({ data });
};

exports.findById = (id) => {
  return prisma.partners.findUnique({ where: { id: BigInt(id) } });
};

exports.findByAgreementId = (agreementId) => {
  return prisma.partners.findUnique({ where: { agreement_id: agreementId } });
};

exports.findByOrderId = (orderId) => {
  return prisma.partners.findFirst({
    where: {
      payment_details: {
        path: ['order_id'],
        equals: orderId
      }
    }
  });
};

/**
 * Find partner by email OR phone number (for update logic)
 * Returns the first matching partner if either email or phone matches
 */
exports.findByEmailOrPhone = (email, phoneNumber) => {
  return prisma.partners.findFirst({
    where: {
      OR: [
        { email: email },
        { phone_number: phoneNumber }
      ]
    }
  });
};

/**
 * Find partner by email only
 */
exports.findByEmail = (email) => {
  return prisma.partners.findUnique({ where: { email } });
};

/**
 * Find partner by phone number only
 */
exports.findByPhoneNumber = (phoneNumber) => {
  return prisma.partners.findUnique({ where: { phone_number: phoneNumber } });
};

exports.update = (id, data) => {
  return prisma.partners.update({ where: { id: BigInt(id) }, data });
};

exports.findStalePayments = (cutoffTime) => {
  return prisma.partners.findMany({
    where: {
      status: {
        in: ['payment_failed', 'payment_dropped']
      },
      payment_details: {
        path: ['updated_at'],
        lt: cutoffTime.toISOString()
      }
    }
  });
};

exports.resetPaymentDetails = (id) => {
  return prisma.partners.update({
    where: { id: BigInt(id) },
    data: {
      payment_details: { orders: [] },
      status: 'payment_pending'
    }
  });
};