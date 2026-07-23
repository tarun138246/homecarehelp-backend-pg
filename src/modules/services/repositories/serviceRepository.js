const prisma = require('../../../common/prismaClient');

const BASIC_SELECT = { 
  service_id: true,
  service_name: true, 
  images: true, 
  base_price: true,
  description: true
};

// ============================================================
// STANDARD QUERIES (using Prisma's native API)
// ============================================================

exports.findAll = (where = {}, orderBy, skip, take) => {
  return prisma.services.findMany({ 
    where, 
    orderBy, 
    select: BASIC_SELECT,
    skip,
    take
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

// ============================================================
// SEARCH QUERIES (using $queryRawUnsafe - tsvector is Unsupported)
// Prisma docs: https://www.prisma.io/docs/orm/prisma-schema/data-model/unsupported-database-features
// "Fields of Unsupported type can only be queried using $queryRaw or $queryRawUnsafe"
// ============================================================

exports.searchServices = async (searchTerm, additionalWhere = {}, orderBy, skip, take) => {
  const cleanTerm = searchTerm.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  if (!cleanTerm) return [];

  // Build tsquery string: "Ro water purifier" -> "Ro:* & water:* & purifier:*"
  const tsquery = cleanTerm
    .split(/\s+/)
    .filter(t => t)
    .map(t => `${t}:*`)
    .join(' & ');

  let whereClause = "WHERE s.is_active = true AND s.search_vector @@ to_tsquery('english', '" + tsquery + "')";
  
  if (additionalWhere.is_popular !== undefined) {
    whereClause += " AND s.is_popular = " + additionalWhere.is_popular;
  }
  
  if (additionalWhere.base_price?.gte !== undefined) {
    whereClause += " AND s.base_price >= " + additionalWhere.base_price.gte;
  }
  if (additionalWhere.base_price?.lte !== undefined) {
    whereClause += " AND s.base_price <= " + additionalWhere.base_price.lte;
  }
  
  if (additionalWhere.service_subcategories?.category_id !== undefined) {
    whereClause += " AND s.subcategory_id IN (SELECT subcategory_id FROM service_subcategories WHERE category_id = " + additionalWhere.service_subcategories.category_id + ")";
  }
  
  if (additionalWhere.subcategory_id !== undefined) {
    whereClause += " AND s.subcategory_id = " + additionalWhere.subcategory_id;
  }

  let orderClause = "ORDER BY s.is_popular DESC, s.service_name ASC";
  if (orderBy?.popularity_rank) {
    orderClause = "ORDER BY s.popularity_rank " + orderBy.popularity_rank;
  }

  const query = `
    SELECT s.service_id, s.service_name, s.images, s.base_price, s.description
    FROM services s
    ${whereClause}
    ${orderClause}
    LIMIT ${take} OFFSET ${skip}
  `;

  return prisma.$queryRawUnsafe(query);
};

exports.countSearchResults = async (searchTerm, additionalWhere = {}) => {
  const cleanTerm = searchTerm.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  if (!cleanTerm) return 0;

  const tsquery = cleanTerm
    .split(/\s+/)
    .filter(t => t)
    .map(t => `${t}:*`)
    .join(' & ');

  let whereClause = "WHERE is_active = true AND search_vector @@ to_tsquery('english', '" + tsquery + "')";
  
  if (additionalWhere.service_subcategories?.category_id !== undefined) {
    whereClause += " AND subcategory_id IN (SELECT subcategory_id FROM service_subcategories WHERE category_id = " + additionalWhere.service_subcategories.category_id + ")";
  }
  
  if (additionalWhere.subcategory_id !== undefined) {
    whereClause += " AND subcategory_id = " + additionalWhere.subcategory_id;
  }

  const query = `SELECT COUNT(*) as count FROM services ${whereClause}`;
  
  const result = await prisma.$queryRawUnsafe(query);
  return Number(result[0].count);
};