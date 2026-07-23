// repositories/serviceRepository.js
const prisma = require('../../../common/prismaClient');

// Basic select fields for list view (lightweight)
const BASIC_SELECT = { 
  service_id: true,
  service_name: true, 
  images: true, 
  base_price: true,
  description: true
};

/**
 * Find all services with optional filtering
 */
exports.findAll = (where = {}, orderBy, skip, take) => {
  return prisma.services.findMany({ 
    where, 
    orderBy, 
    select: BASIC_SELECT,
    skip,
    take
  });
};

/**
 * Count total services matching filters
 */
exports.countServices = (where = {}) => {
  return prisma.services.count({ where });
};

/**
 * Full-text search using PostgreSQL tsvector
 * 
 * How it works:
 * 1. Takes user search like "Ro water purifier"
 * 2. Converts to tsquery format: "Ro:* & water:* & purifier:*"
 *    - The :* means prefix matching (matches "purifier", "purifiers", "purification")
 *    - The & means ALL terms must match
 * 3. Prisma's `search` filter on tsvector generates: WHERE search_vector @@ to_tsquery('Ro:* & water:* & purifier:*')
 * 4. PostgreSQL uses GIN index for lightning-fast lookup
 */
exports.searchServices = async (searchTerm, additionalWhere = {}, orderBy, skip, take) => {
  // Clean and format search term
  // Split by whitespace, remove empty strings, add prefix matching
  const formattedTerm = searchTerm
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 0)  // Remove empty strings from multiple spaces
    .map(term => {
      // Remove special characters that break tsquery
      const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '');
      return `${cleanTerm}:*`;  // Add prefix matching
    })
    .join(' & ');  // AND operator - all terms must match
  
  // If after cleaning there's nothing to search, return empty
  if (!formattedTerm) {
    return [];
  }

  // Build the where clause
  // IMPORTANT: search_vector filter must be at the top level, not nested in AND
  const where = {
    ...additionalWhere,  // Spread existing filters (is_active, base_price, etc.)
    search_vector: {
      search: formattedTerm  // Prisma translates this to @@ to_tsquery()
    }
  };

  return prisma.services.findMany({
    where,
    select: BASIC_SELECT,
    // Default order: popular services first, then by name
    orderBy: orderBy || [
      { is_popular: 'desc' },
      { service_name: 'asc' }
    ],
    skip,
    take
  });
};

/**
 * Count search results (for pagination)
 */
exports.countSearchResults = async (searchTerm, additionalWhere = {}) => {
  const formattedTerm = searchTerm
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 0)
    .map(term => {
      const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '');
      return `${cleanTerm}:*`;
    })
    .join(' & ');
  
  if (!formattedTerm) {
    return 0;
  }

  return prisma.services.count({
    where: {
      ...additionalWhere,
      search_vector: {
        search: formattedTerm
      }
    }
  });
};

/**
 * Find a single service by ID
 */
exports.findById = (service_id) => {
  return prisma.services.findUnique({ 
    where: { service_id } 
  });
};

/**
 * Find service with category and subcategory info (for detail page)
 */
exports.findByIdWithCategory = (service_id) => {
  return prisma.services.findUnique({
    where: { service_id },
    include: {
      service_subcategories: {
        include: {
          service_categories: true  // Get parent category name
        }
      }
    }
  });
};

/**
 * Find services by category ID
 */
exports.findByCategoryId = (categoryId, skip, take) => {
  return prisma.services.findMany({
    where: {
      is_active: true,
      service_subcategories: { 
        category_id: Number(categoryId) 
      }
    },
    select: BASIC_SELECT,
    skip,
    take
  });
};

/**
 * Count services by category
 */
exports.countByCategoryId = (categoryId) => {
  return prisma.services.count({
    where: {
      is_active: true,
      service_subcategories: { 
        category_id: Number(categoryId) 
      }
    }
  });
};

/**
 * Find services by subcategory ID
 */
exports.findBySubcategoryId = (subcategoryId, skip, take) => {
  return prisma.services.findMany({
    where: { 
      is_active: true, 
      subcategory_id: Number(subcategoryId) 
    },
    select: BASIC_SELECT,
    skip,
    take
  });
};

/**
 * Count services by subcategory
 */
exports.countBySubcategoryId = (subcategoryId) => {
  return prisma.services.count({
    where: { 
      is_active: true, 
      subcategory_id: Number(subcategoryId) 
    }
  });
};