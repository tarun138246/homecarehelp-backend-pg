const prisma = require('../../../common/prismaClient');

exports.findByEmail = (email) => {
  return prisma.users.findUnique({ where: { email } });
};

exports.findByPhone = (phone_number) => {
  return prisma.users.findUnique({ where: { phone_number } });
};

exports.findById = (user_id) => {
  return prisma.users.findUnique({ where: { user_id: BigInt(user_id) } });
};

exports.create = (data) => {
  return prisma.users.create({ data });
};

exports.update = (user_id, data) => {
  return prisma.users.update({ where: { user_id: BigInt(user_id) }, data });
};

exports.updateLastLogin = (user_id) => {
  return prisma.users.update({
    where: { user_id: BigInt(user_id) },
    data: { last_login: new Date() }
  });
};
