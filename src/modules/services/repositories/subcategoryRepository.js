const prisma = require('../../../common/prismaClient');

exports.findByCategory = (categoryId) => {
  return prisma.service_subcategories.findMany({
    where: { category_id: Number(categoryId) },
    select: { subcategory_id: true, subcategory_name: true }
  });
};

exports.findById = (subcategory_id) => {
  return prisma.service_subcategories.findUnique({
    where: { subcategory_id: Number(subcategory_id) }
  });
};
