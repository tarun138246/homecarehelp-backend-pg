const prisma = require('../../../common/prismaClient');

const BASIC_SELECT = { 
  service_id: true, 
  service_name: true, 
  images: true, 
  base_price: true 
};

exports.findAll = (where = {}, orderBy, skip, take) => {
  return prisma.services.findMany({ 
    where, 
    orderBy, 
    select: BASIC_SELECT,
    skip,
    take
  });
};

// Add count method for pagination
exports.countServices = (where = {}) => {
  return prisma.services.count({ where });
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

exports.findByCategoryId = (categoryId, skip, take) => {
  return prisma.services.findMany({
    where: {
      is_active: true,
      service_subcategories: { category_id: Number(categoryId) }
    },
    select: BASIC_SELECT,
    skip,
    take
  });
};

// Add count for category services
exports.countByCategoryId = (categoryId) => {
  return prisma.services.count({
    where: {
      is_active: true,
      service_subcategories: { category_id: Number(categoryId) }
    }
  });
};

exports.findBySubcategoryId = (subcategoryId, skip, take) => {
  return prisma.services.findMany({
    where: { is_active: true, subcategory_id: Number(subcategoryId) },
    select: BASIC_SELECT,
    skip,
    take
  });
};

// Add count for subcategory services
exports.countBySubcategoryId = (subcategoryId) => {
  return prisma.services.count({
    where: { is_active: true, subcategory_id: Number(subcategoryId) }
  });
};