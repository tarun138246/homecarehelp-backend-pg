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
  deleteSubcategory
};