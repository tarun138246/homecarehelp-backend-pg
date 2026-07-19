const prisma = require('../../../common/prismaClient');

const BASIC_SELECT = { service_name: true, images: true, base_price: true };

exports.findAll = (where = {}, orderBy) => {
  return prisma.services.findMany({ where, orderBy, select: BASIC_SELECT });
};

exports.findById = (service_id) => {
  return prisma.services.findUnique({ where: { service_id } });
};

exports.findByIdWithCategory = (service_id) => {
  return prisma.services.findUnique({
    where: { service_id },
    include: {
      service_subcategories: {
        include: {
          service_categories: true
        }
      }
    }
  });
};

exports.findByCategoryId = (categoryId) => {
  return prisma.services.findMany({
    where: {
      is_active: true,
      service_subcategories: { category_id: Number(categoryId) }
    },
    select: BASIC_SELECT
  });
};

exports.findBySubcategoryId = (subcategoryId) => {
  return prisma.services.findMany({
    where: { is_active: true, subcategory_id: Number(subcategoryId) },
    select: BASIC_SELECT
  });
};
