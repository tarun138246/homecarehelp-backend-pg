// repositories/categoryRepository.js
const prisma = require('../../../common/prismaClient');

exports.findAll = () => {
  return prisma.service_categories.findMany({
    select: { category_id: true, category_name: true }
  });
};

exports.findById = (category_id) => {
  return prisma.service_categories.findUnique({ 
    where: { category_id: Number(category_id) },
    include: {
      service_subcategories: {
        select: {
          subcategory_id: true,
          subcategory_name: true
        }
      }
    }
  });
};