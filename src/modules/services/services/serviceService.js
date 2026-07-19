const serviceRepo = require('../repositories/serviceRepository');
const categoryRepo = require('../repositories/categoryRepository');
const subcategoryRepo = require('../repositories/subcategoryRepository');

const toBasicShape = (s) => ({
  service_name: s.service_name,
  images: s.images,
  base_price: s.base_price
});

exports.listServices = async ({ search, min_price, max_price, popular }) => {
  const where = { is_active: true };
  if (search) where.service_name = { contains: search, mode: 'insensitive' };
  if (popular === 'true' || popular === true) where.is_popular = true;

  // base_price is the single field used for all price filtering/sorting,
  // regardless of a service's actual pricing_type (per-sqft, min_price, etc).
  if (min_price || max_price) {
    where.base_price = {};
    if (min_price) where.base_price.gte = parseFloat(min_price);
    if (max_price) where.base_price.lte = parseFloat(max_price);
  }

  const orderBy = (popular === 'true' || popular === true)
    ? { popularity_rank: 'asc' }
    : undefined;

  const services = await serviceRepo.findAll(where, orderBy);
  return services.map(toBasicShape);
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

exports.getServicesByCategory = async (categoryId) => {
  const services = await serviceRepo.findByCategoryId(categoryId);
  return services.map(toBasicShape);
};

exports.getServicesBySubcategory = async (subcategoryId) => {
  const services = await serviceRepo.findBySubcategoryId(subcategoryId);
  return services.map(toBasicShape);
};
