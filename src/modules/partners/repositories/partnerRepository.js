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

exports.update = (id, data) => {
  return prisma.partners.update({ where: { id: BigInt(id) }, data });
};

