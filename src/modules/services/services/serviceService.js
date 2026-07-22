const serviceRepo = require('../repositories/serviceRepository');
const categoryRepo = require('../repositories/categoryRepository');
const subcategoryRepo = require('../repositories/subcategoryRepository');

const DEFAULT_PAGE_SIZE = 20;

const toBasicShape = (s) => ({
  service_id: s.service_id,
  service_name: s.service_name,
  images: s.images,
  base_price: s.base_price,
  // Include relevance score if it exists (from search)
  ...(s._relevance && { relevance_score: s._relevance })
});

exports.listServices = async ({ search, min_price, max_price, popular, page = 1 }) => {
  const where = { is_active: true };
  if (popular === 'true' || popular === true) where.is_popular = true;

  // Price filtering
  if (min_price || max_price) {
    where.base_price = {};
    if (min_price) where.base_price.gte = parseFloat(min_price);
    if (max_price) where.base_price.lte = parseFloat(max_price);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const skip = (pageNum - 1) * DEFAULT_PAGE_SIZE;
  const take = DEFAULT_PAGE_SIZE;

  let orderBy;
  if (popular === 'true' || popular === true) {
    orderBy = { popularity_rank: 'asc' };
  }

  // Use full-text search if search term is provided
  if (search && search.trim()) {
    const [total, services] = await Promise.all([
      serviceRepo.countSearchResults(search, where),
      serviceRepo.searchServices(search, where, orderBy, skip, take)
    ]);

    const totalPages = Math.ceil(total / DEFAULT_PAGE_SIZE);

    return {
      data: services.map(toBasicShape),
      pagination: {
        current_page: pageNum,
        per_page: DEFAULT_PAGE_SIZE,
        total_items: total,
        total_pages: totalPages,
        has_next_page: pageNum < totalPages,
        has_previous_page: pageNum > 1
      },
      search_metadata: {
        search_term: search,
        search_type: 'full_text'
      }
    };
  }

  // Regular listing without search
  const [total, services] = await Promise.all([
    serviceRepo.countServices(where),
    serviceRepo.findAll(where, orderBy, skip, take)
  ]);

  const totalPages = Math.ceil(total / DEFAULT_PAGE_SIZE);

  return {
    data: services.map(toBasicShape),
    pagination: {
      current_page: pageNum,
      per_page: DEFAULT_PAGE_SIZE,
      total_items: total,
      total_pages: totalPages,
      has_next_page: pageNum < totalPages,
      has_previous_page: pageNum > 1
    }
  };
};

exports.getServiceDetail = async (serviceId) => {
  const service = await serviceRepo.findByIdWithCategory(serviceId);
  if (!service) throw Object.assign(new Error('Service not found'), { status: 404 });

  const { service_subcategories, ...rest } = service;
  return {
    ...rest,
    category_name: service_subcategories?.service_categories?.category_name ?? null,
    subcategory_name: service_subcategories?.subcategory_name ?? null
  };
};

exports.getCategories = async () => {
  return categoryRepo.findAll();
};

exports.getCategoryWithSubcategories = async (categoryId) => {
  const category = await categoryRepo.findById(categoryId);
  if (!category) throw Object.assign(new Error('Category not found'), { status: 404 });

  const subcategories = await subcategoryRepo.findByCategory(categoryId);
  return {
    category_id: category.category_id,
    category_name: category.category_name,
    subcategories: subcategories.map((s) => s.subcategory_name)
  };
};

exports.getServicesByCategory = async (categoryId, page = 1) => {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const skip = (pageNum - 1) * DEFAULT_PAGE_SIZE;
  const take = DEFAULT_PAGE_SIZE;

  const [total, services] = await Promise.all([
    serviceRepo.countByCategoryId(categoryId),
    serviceRepo.findByCategoryId(categoryId, skip, take)
  ]);

  const totalPages = Math.ceil(total / DEFAULT_PAGE_SIZE);

  return {
    data: services.map(toBasicShape),
    pagination: {
      current_page: pageNum,
      per_page: DEFAULT_PAGE_SIZE,
      total_items: total,
      total_pages: totalPages,
      has_next_page: pageNum < totalPages,
      has_previous_page: pageNum > 1
    }
  };
};

exports.getServicesBySubcategory = async (subcategoryId, page = 1) => {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const skip = (pageNum - 1) * DEFAULT_PAGE_SIZE;
  const take = DEFAULT_PAGE_SIZE;

  const [total, services] = await Promise.all([
    serviceRepo.countBySubcategoryId(subcategoryId),
    serviceRepo.findBySubcategoryId(subcategoryId, skip, take)
  ]);

  const totalPages = Math.ceil(total / DEFAULT_PAGE_SIZE);

  return {
    data: services.map(toBasicShape),
    pagination: {
      current_page: pageNum,
      per_page: DEFAULT_PAGE_SIZE,
      total_items: total,
      total_pages: totalPages,
      has_next_page: pageNum < totalPages,
      has_previous_page: pageNum > 1
    }
  };
};

// New method: Advanced search with filtering
exports.searchServices = async (searchTerm, filters = {}, page = 1) => {
  if (!searchTerm || !searchTerm.trim()) {
    throw Object.assign(new Error('Search term is required'), { status: 400 });
  }

  const where = { is_active: true };
  
  // Apply filters
  if (filters.category_id) {
    where.service_subcategories = { 
      category_id: Number(filters.category_id) 
    };
  }
  
  if (filters.subcategory_id) {
    where.subcategory_id = Number(filters.subcategory_id);
  }

  if (filters.min_price || filters.max_price) {
    where.base_price = {};
    if (filters.min_price) where.base_price.gte = parseFloat(filters.min_price);
    if (filters.max_price) where.base_price.lte = parseFloat(filters.max_price);
  }

  const pageNum = Math.max(1, parseInt(page) || 1);
  const skip = (pageNum - 1) * DEFAULT_PAGE_SIZE;
  const take = DEFAULT_PAGE_SIZE;

  const [total, services] = await Promise.all([
    serviceRepo.countSearchResults(searchTerm, where),
    serviceRepo.searchServices(searchTerm, where, undefined, skip, take)
  ]);

  const totalPages = Math.ceil(total / DEFAULT_PAGE_SIZE);

  return {
    data: services.map(toBasicShape),
    pagination: {
      current_page: pageNum,
      per_page: DEFAULT_PAGE_SIZE,
      total_items: total,
      total_pages: totalPages,
      has_next_page: pageNum < totalPages,
      has_previous_page: pageNum > 1
    },
    search_metadata: {
      search_term: searchTerm,
      applied_filters: filters
    }
  };
};