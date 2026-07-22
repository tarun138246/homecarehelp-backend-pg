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

// New method: Full-text search with PostgreSQL tsvector
exports.searchServices = async (searchTerm, additionalWhere = {}, orderBy, skip, take) => {
  // Clean and prepare the search term for tsquery
  const formattedTerm = searchTerm
    .trim()
    .split(/\s+/)
    .map(term => `${term}:*`)  
    .join(' & ');  
  
  const where = {
    ...additionalWhere,
    AND: [
      // Full-text search condition
      {
        search_vector: {
          search: formattedTerm
        }
      }
    ]
  };

  return prisma.services.findMany({
    where,
    select: {
      ...BASIC_SELECT,
      // Add relevance score for ranking
      _relevance: {
        fields: ['search_vector'],
        search: formattedTerm,
        sort: true,
      }
    },
    orderBy: orderBy || {
      _relevance: 'desc'  // Order by relevance by default
    },
    skip,
    take
  });
};

// Count for search results
exports.countSearchResults = async (searchTerm, additionalWhere = {}) => {
  const formattedTerm = searchTerm
    .trim()
    .split(/\s+/)
    .map(term => `${term}:*`)
    .join(' & ');
  
  return prisma.services.count({
    where: {
      ...additionalWhere,
      search_vector: {
        search: formattedTerm
      }
    }
  });
};

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

exports.countBySubcategoryId = (subcategoryId) => {
  return prisma.services.count({
    where: { is_active: true, subcategory_id: Number(subcategoryId) }
  });
};