const superAdminService = require('../services/adminService');
const logger = require('../../../common/utils/logger');

exports.notImplemented = (req, res) => {
  res.status(501).json({ error: 'Admin module not implemented yet' });
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await superAdminService.authenticateSuperAdmin(email.trim(), password);
    res.json({ token: result.token, email: result.email });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({ error: err.message });
    }
    next(err);
  }
};

/**
 * GET /bookings – simplified list (name, phone, total_amount, address)
 */
exports.getBookings = async (req, res, next) => {
  try {
    const bookings = await superAdminService.getAllBookings();
    res.json({ bookings });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /booking/:id – single booking with full details (same format as old)
 */
exports.getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await superAdminService.getBookingById(id);
    res.json({ booking });
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------------
//  CATEGORY ENDPOINTS
// ------------------------------------------------------------

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await superAdminService.getAllCategories();
    res.json({ categories });
  } catch (err) {
    next(err);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const category = await superAdminService.createCategory(req.body);
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const category = await superAdminService.updateCategory(req.params.id, req.body);
    res.json({ category });
  } catch (err) {
    next(err);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const result = await superAdminService.deleteCategory(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------------
//  SUBCATEGORY ENDPOINTS
// ------------------------------------------------------------

exports.getSubcategories = async (req, res, next) => {
  try {
    const subcategories = await superAdminService.getAllSubcategories();
    res.json({ subcategories });
  } catch (err) {
    next(err);
  }
};

exports.createSubcategory = async (req, res, next) => {
  try {
    const subcategory = await superAdminService.createSubcategory(req.body);
    res.status(201).json({ subcategory });
  } catch (err) {
    next(err);
  }
};

exports.updateSubcategory = async (req, res, next) => {
  try {
    const subcategory = await superAdminService.updateSubcategory(req.params.id, req.body);
    res.json({ subcategory });
  } catch (err) {
    next(err);
  }
};

exports.deleteSubcategory = async (req, res, next) => {
  try {
    const result = await superAdminService.deleteSubcategory(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};


// ------------------------------------------------------------
//  SERVICE ENDPOINTS
// ------------------------------------------------------------

exports.getServices = async (req, res, next) => {
  try {
    const services = await superAdminService.getAllServices();
    res.json({ services });
  } catch (err) {
    next(err);
  }
};

exports.createService = async (req, res, next) => {
  try {
    const service = await superAdminService.createService(req.body);
    res.status(201).json({ service });
  } catch (err) {
    next(err);
  }
};

exports.updateService = async (req, res, next) => {
  try {
    const service = await superAdminService.updateService(req.params.id, req.body);
    res.json({ service });
  } catch (err) {
    next(err);
  }
};

exports.deleteService = async (req, res, next) => {
  try {
    const result = await superAdminService.deleteService(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};