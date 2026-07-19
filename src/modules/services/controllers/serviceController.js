const serviceService = require('../services/serviceService');

exports.listServices = async (req, res, next) => {
  try {
    const { search, min_price, max_price, minPrice, maxPrice, popular } = req.query;
    const services = await serviceService.listServices({
      search,
      min_price: min_price ?? minPrice,
      max_price: max_price ?? maxPrice,
      popular
    });
    res.json(services);
  } catch (err) {
    next(err);
  }
};

exports.getServiceDetail = async (req, res, next) => {
  try {
    const service = await serviceService.getServiceDetail(req.params.serviceId);
    res.json(service);
  } catch (err) {
    next(err);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await serviceService.getCategories();
    res.json(categories);
  } catch (err) {
    next(err);
  }
};

exports.getCategoryWithSubcategories = async (req, res, next) => {
  try {
    const result = await serviceService.getCategoryWithSubcategories(req.params.categoryId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.getServicesByCategory = async (req, res, next) => {
  try {
    const services = await serviceService.getServicesByCategory(req.params.categoryId);
    res.json(services);
  } catch (err) {
    next(err);
  }
};

exports.getServicesBySubcategory = async (req, res, next) => {
  try {
    const services = await serviceService.getServicesBySubcategory(req.params.subcategoryId);
    res.json(services);
  } catch (err) {
    next(err);
  }
};
