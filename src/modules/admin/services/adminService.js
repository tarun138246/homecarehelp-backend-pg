const crypto = require('crypto');
const { signToken } = require('../../../common/utils/jwt');
const adminRepo = require('../repositories/adminRepository');

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Authenticate superadmin using environment‑stored credentials
 */
async function authenticateSuperAdmin(email, password) {
  const configuredEmail = process.env.SUPERADMIN_EMAIL;
  const configuredPassword = process.env.SUPERADMIN_PASSWORD;

  if (!configuredEmail || !configuredPassword) {
    throw Object.assign(new Error('Superadmin not configured'), { status: 500 });
  }

  // 🔐 Always evaluate both comparisons – no short‑circuit
  const emailMatch = timingSafeEqual(email, configuredEmail);
  const passwordMatch = timingSafeEqual(password, configuredPassword);

  if (!emailMatch || !passwordMatch) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const token = signToken({ email, type: 'superadmin' });
  return { token, email };
}

/**
 * Helper: validate BigInt before converting (optional but safe)
 */
function toBigIntOrThrow(str, fieldName) {
  try {
    return BigInt(str);
  } catch {
    throw Object.assign(new Error(`${fieldName} must be a valid integer`), { status: 400 });
  }
}

/**
 * Fetch all bookings – simplified list (booking_id, name, phone, total_amount, address)
 */
async function getAllBookings() {
  const bookings = await adminRepo.findAllBookings();

  return bookings.map((b) => ({
    booking_id: b.booking_id.toString(),
    name: b.users.name,
    phone_number: b.users.phone_number,
    total_amount: b.total_amount.toString(),
    address: b.address,
  }));
}

/**
 * Fetch a single booking by ID – full detail (all booking information)
 */
async function getBookingById(id) {
  // Optional validation – converts safely and returns 400 on garbage input
  const bookingId = toBigIntOrThrow(id, 'Booking ID');

  const booking = await adminRepo.findBookingById(bookingId);

  if (!booking) {
    throw Object.assign(new Error('Booking not found'), { status: 404 });
  }

  // Fetch service details from services_id array
  const servicesBooked = await adminRepo.fetchServicesDetails(booking.services_id);

  return {
    booking_id: booking.booking_id.toString(),
    name: booking.users.name,
    email: booking.users.email,
    phone_number: booking.users.phone_number,
    total_amount: booking.total_amount.toString(),
    address: booking.address,
    services_booked: servicesBooked,
    scheduled_date: booking.scheduled_date,
    time_slot: booking.time_slot,
    payment_status: booking.payment_status,
    payment_details: booking.payment_details,
    status: booking.status,
    created_at: booking.created_at,
  };
}

// ============================================================
//  CATEGORY MANAGEMENT
// ============================================================

async function getAllCategories() {
  const categories = await adminRepo.findAllCategories();
  return categories.map(cat => ({
    category_id: cat.category_id,
    category_name: cat.category_name,
    subcategory_count: cat._count.service_subcategories,
    created_at: cat.created_at,
    updated_at: cat.updated_at
  }));
}

async function createCategory({ category_name }) {
  if (!category_name || typeof category_name !== 'string' || !category_name.trim()) {
    throw Object.assign(new Error('Category name is required'), { status: 400 });
  }
  const existing = await adminRepo.findCategoryByName(category_name.trim());
  if (existing) {
    throw Object.assign(new Error('Category name already exists'), { status: 409 });
  }
  const category = await adminRepo.createCategory({ category_name: category_name.trim() });
  return category;
}

async function updateCategory(id, { category_name }) {
  const catId = parseInt(id, 10);
  if (isNaN(catId)) {
    throw Object.assign(new Error('Invalid category ID'), { status: 400 });
  }
  if (!category_name || !category_name.trim()) {
    throw Object.assign(new Error('Category name is required'), { status: 400 });
  }

  const category = await adminRepo.findCategoryById(catId);
  if (!category) {
    throw Object.assign(new Error('Category not found'), { status: 404 });
  }

  const existing = await adminRepo.findCategoryByName(category_name.trim());
  if (existing && existing.category_id !== catId) {
    throw Object.assign(new Error('Category name already exists'), { status: 409 });
  }

  const updated = await adminRepo.updateCategory(catId, { category_name: category_name.trim() });
  return updated;
}

async function deleteCategory(id) {
  const catId = parseInt(id, 10);
  if (isNaN(catId)) {
    throw Object.assign(new Error('Invalid category ID'), { status: 400 });
  }

  const category = await adminRepo.findCategoryById(catId);
  if (!category) {
    throw Object.assign(new Error('Category not found'), { status: 404 });
  }

  // Prevent deletion if any subcategory has services
  const subcategories = await adminRepo.getSubcategoriesByCategoryId(catId);
  for (const sub of subcategories) {
    if (sub._count.services > 0) {
      throw Object.assign(
        new Error('Cannot delete category: it has subcategories with assigned services'),
        { status: 409 }
      );
    }
  }

  // Cascade delete will remove any subcategory without services
  await adminRepo.deleteCategory(catId);
  return { message: 'Category deleted successfully' };
}

// ============================================================
//  SUBCATEGORY MANAGEMENT
// ============================================================

async function getAllSubcategories() {
  const subcategories = await adminRepo.findAllSubcategories();
  return subcategories.map(sub => ({
    subcategory_id: sub.subcategory_id,
    subcategory_name: sub.subcategory_name,
    category_id: sub.category_id,
    category_name: sub.service_categories.category_name,
    services_count: sub._count.services,
    created_at: sub.created_at,
    updated_at: sub.updated_at
  }));
}

async function createSubcategory({ category_id, subcategory_name }) {
  const catId = parseInt(category_id, 10);
  if (isNaN(catId)) {
    throw Object.assign(new Error('Invalid category_id'), { status: 400 });
  }
  if (!subcategory_name || !subcategory_name.trim()) {
    throw Object.assign(new Error('Subcategory name is required'), { status: 400 });
  }

  const category = await adminRepo.findCategoryById(catId);
  if (!category) {
    throw Object.assign(new Error('Category not found'), { status: 404 });
  }

  const existing = await adminRepo.findSubcategoryByNameAndCategory(subcategory_name.trim(), catId);
  if (existing) {
    throw Object.assign(new Error('Subcategory name already exists in this category'), { status: 409 });
  }

  const sub = await adminRepo.createSubcategory({
    category_id: catId,
    subcategory_name: subcategory_name.trim()
  });
  return sub;
}

async function updateSubcategory(id, { subcategory_name }) {
  const subId = parseInt(id, 10);
  if (isNaN(subId)) {
    throw Object.assign(new Error('Invalid subcategory ID'), { status: 400 });
  }
  if (!subcategory_name || !subcategory_name.trim()) {
    throw Object.assign(new Error('Subcategory name is required'), { status: 400 });
  }

  const subcategory = await adminRepo.findSubcategoryById(subId);
  if (!subcategory) {
    throw Object.assign(new Error('Subcategory not found'), { status: 404 });
  }

  const existing = await adminRepo.findSubcategoryByNameAndCategory(
    subcategory_name.trim(),
    subcategory.category_id
  );
  if (existing && existing.subcategory_id !== subId) {
    throw Object.assign(new Error('Subcategory name already exists in this category'), { status: 409 });
  }

  const updated = await adminRepo.updateSubcategory(subId, {
    subcategory_name: subcategory_name.trim()
  });
  return updated;
}

async function deleteSubcategory(id) {
  const subId = parseInt(id, 10);
  if (isNaN(subId)) {
    throw Object.assign(new Error('Invalid subcategory ID'), { status: 400 });
  }

  const subcategory = await adminRepo.findSubcategoryById(subId);
  if (!subcategory) {
    throw Object.assign(new Error('Subcategory not found'), { status: 404 });
  }

  const servicesCount = await adminRepo.getServiceCountBySubcategoryId(subId);
  if (servicesCount > 0) {
    throw Object.assign(
      new Error('Cannot delete subcategory: it has assigned services'),
      { status: 409 }
    );
  }

  await adminRepo.deleteSubcategory(subId);
  return { message: 'Subcategory deleted successfully' };
}


// ============================================================
//  SERVICE MANAGEMENT
// ============================================================

/**
 * List all services (admin view)
 */
async function getAllServices() {
  const services = await adminRepo.findAllServices();

  return services.map(service => ({
    service_id: service.service_id,
    service_name: service.service_name,
    subcategory_id: service.subcategory_id,
    thumbnail_image: Array.isArray(service.images) && service.images.length > 0
      ? service.images[0]
      : null,                    
  }));
}


/** Get Service by ID */
async function getServiceById(id) {
  const service = await adminRepo.findServiceById(id);
  if (!service) {
    throw Object.assign(new Error('Service not found'), { status: 404 });
  }
  return service;
}

/**
 * Create a new service
 */
async function createService(body) {
  const {
    subcategory_id,
    service_name,
    description,
    pricing_type,
    base_price,
    duration,
    images,
    tags,
    includes,
    variants,
    // optional fields with sensible defaults
    price_multiplier = null,
    visiting_charge = null,
    warranty = null,
    min_price = null,
    price_per_sqft = null,
    bhk_prices = null,
    is_popular = false,
    popularity_rank = null,
    is_active = true,
  } = body;

  // ---------- Validation ----------
  const errors = [];

  if (!service_name || typeof service_name !== 'string' || !service_name.trim()) {
    errors.push('service_name is required');
  }
  if (!subcategory_id || isNaN(parseInt(subcategory_id, 10))) {
    errors.push('subcategory_id must be a valid integer');
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    errors.push('description is required');
  }
  if (!pricing_type || typeof pricing_type !== 'string') {
    errors.push('pricing_type is required');
  }
  if (!duration || typeof duration !== 'string' || !duration.trim()) {
    errors.push('duration is required');
  }

  // images: must be a non-empty array
  if (!Array.isArray(images) || images.length === 0) {
    errors.push('images must be a non-empty array');
  }

  // tags: must be a non-empty array
  if (!Array.isArray(tags) || tags.length === 0) {
    errors.push('tags must be a non-empty array');
  }

  // includes: must be a non-empty array
  if (!Array.isArray(includes) || includes.length === 0) {
    errors.push('includes must be a non-empty array');
  }

  // Conditional required fields
  if (pricing_type === 'fixed') {
    if (base_price === undefined || base_price === null || isNaN(Number(base_price))) {
      errors.push('base_price is required when pricing_type is "fixed"');
    }
  }

  if (pricing_type === 'variants') {
    if (!variants || (Array.isArray(variants) && variants.length === 0) || typeof variants !== 'object') {
      errors.push('variants must be a non-empty array/object when pricing_type is "variants"');
    }
  }

  if (errors.length) {
    throw Object.assign(new Error(`Validation failed: ${errors.join('; ')}`), { status: 400 });
  }

  // Verify subcategory exists
  const subcategory = await adminRepo.findSubcategoryById(parseInt(subcategory_id, 10));
  if (!subcategory) {
    throw Object.assign(new Error('Subcategory not found'), { status: 404 });
  }

  // Generate unique service_id
  const service_id = await adminRepo.generateServiceId(service_name.trim());

  // Build create payload
  const createData = {
    service_id,
    subcategory_id: parseInt(subcategory_id, 10),
    service_name: service_name.trim(),
    description,
    pricing_type,
    duration,
    images,
    tags,
    includes,
    variants: variants || [],
    base_price: base_price ? Number(base_price) : null,
    price_multiplier: price_multiplier ? Number(price_multiplier) : null,
    visiting_charge: visiting_charge ? Number(visiting_charge) : null,
    warranty: warranty || null,
    min_price: min_price ? Number(min_price) : null,
    price_per_sqft: price_per_sqft ? Number(price_per_sqft) : null,
    bhk_prices: bhk_prices || null,
    is_popular: Boolean(is_popular),
    popularity_rank: popularity_rank ? parseInt(popularity_rank, 10) : null,
    is_active: Boolean(is_active),
  };

  const service = await adminRepo.createService(createData);
  return service;
}

/**
 * Update an existing service (partial)
 */
async function updateService(id, body) {
  // id is the service_id string
  if (!id || typeof id !== 'string') {
    throw Object.assign(new Error('Invalid service ID'), { status: 400 });
  }

  const existing = await adminRepo.findServiceById(id);
  if (!existing) {
    throw Object.assign(new Error('Service not found'), { status: 404 });
  }

  // Build an object with only the fields that are present in the body
  const allowedFields = [
    'subcategory_id', 'service_name', 'description', 'pricing_type',
    'base_price', 'min_price', 'price_per_sqft', 'duration', 'warranty',
    'images', 'includes', 'tags', 'variants', 'bhk_prices',
    'is_popular', 'popularity_rank', 'is_active', 'price_multiplier',
    'visiting_charge'
  ];

  const updateData = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      // Parse numeric fields
      if (['subcategory_id', 'popularity_rank'].includes(field)) {
        const val = parseInt(body[field], 10);
        if (isNaN(val)) continue; // ignore invalid numbers
        updateData[field] = val;
      } else if (['base_price', 'min_price', 'price_per_sqft', 'price_multiplier', 'visiting_charge'].includes(field)) {
        const val = parseFloat(body[field]);
        if (isNaN(val)) continue;
        updateData[field] = val;
      } else {
        // String or JSON fields – accept as-is (validation could be added if needed)
        updateData[field] = body[field];
      }
    }
  }

  // If subcategory_id is being changed, verify it exists
  if (updateData.subcategory_id) {
    const sub = await adminRepo.findSubcategoryById(updateData.subcategory_id);
    if (!sub) {
      throw Object.assign(new Error('Target subcategory not found'), { status: 404 });
    }
  }

  // Pricing type constraints could be checked here (optional).

  if (Object.keys(updateData).length === 0) {
    throw Object.assign(new Error('No valid fields provided for update'), { status: 400 });
  }

  const updated = await adminRepo.updateService(id, updateData);
  return updated;
}

/**
 * Delete a service
 */
async function deleteService(id) {
  if (!id || typeof id !== 'string') {
    throw Object.assign(new Error('Invalid service ID'), { status: 400 });
  }

  const existing = await adminRepo.findServiceById(id);
  if (!existing) {
    throw Object.assign(new Error('Service not found'), { status: 404 });
  }

  // No checks against bookings – just delete
  await adminRepo.deleteService(id);
  return { message: 'Service deleted successfully' };
}


module.exports = {
  authenticateSuperAdmin,
  getAllBookings,
  getBookingById,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
};