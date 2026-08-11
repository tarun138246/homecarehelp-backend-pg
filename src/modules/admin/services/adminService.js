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


/**
 * Manually complete partner agreement with uploaded signature and payment details
 * Used for manual intervention when payment is done but not confirmed
 */
async function manuallyCompleteAgreement(partnerId, signatureBase64, paymentDetails) {
  if (!partnerId || !signatureBase64 || !paymentDetails) {
    throw Object.assign(
      new Error('partnerId, signatureBase64, and paymentDetails are required'),
      { status: 400 }
    );
  }

  // Import required utilities
  const partnerRepo = require('../../partners/repositories/partnerRepository');
  const { generateAgreementPDF } = require('../../../common/utils/agreementPdf');
  const { generateAgreementId, generateInvoiceId } = require('../../../common/utils/agreementId');
  const { generateInvoicePDF } = require('../../../common/utils/invoicePdf');
  const pratimaClient = require('../../../common/utils/pratimaClient');
  const { decrypt } = require('../../../common/utils/crypto');
  const { secureClear } = require('../../../common/utils/memoryCleanup');
  const emailService = require('../../email/emailService');

  // Fetch partner
  const partner = await partnerRepo.findById(partnerId);
  if (!partner) {
    throw Object.assign(new Error('Partner not found'), { status: 404 });
  }

  console.log('[Manual Agreement] Starting for partner:', {
    partnerId: partnerId.toString(),
    currentStatus: partner.status,
    email: partner.email
  });

  // Ensure agreement_id exists
  let updatedPartner = partner;
  if (!partner.agreement_id) {
    const agreementId = generateAgreementId(partnerId);
    updatedPartner = await partnerRepo.update(partnerId, { agreement_id: agreementId });
  }

  // Decrypt ID proof for agreement generation
  let plainIdNumber = null;
  let plainIdType = null;

  try {
    if (updatedPartner.id_proof && updatedPartner.id_proof.length > 0) {
      const primaryProof = updatedPartner.id_proof[0];
      plainIdType = primaryProof.name;
      plainIdNumber = decrypt(primaryProof.number, primaryProof.keyUsed, primaryProof.iv);

      console.log('[Manual Agreement] ID decrypted for agreement:', {
        partnerId: partnerId.toString(),
        idType: plainIdType
      });
    }
  } catch (decryptError) {
    console.error('[Manual Agreement] Failed to decrypt ID:', decryptError);
    throw Object.assign(
      new Error('Failed to decrypt partner ID proof'),
      { status: 500 }
    );
  }

  try {
    // Generate agreement PDF with signature
    console.log('[Manual Agreement] Generating agreement PDF');
    const pdfBuffer = await generateAgreementPDF(
      updatedPartner,
      signatureBase64,
      plainIdType,
      plainIdNumber
    );

    // Generate invoice
    console.log('[Manual Agreement] Generating invoice');
    const invoiceId = generateInvoiceId(partnerId);
    const invoiceBuffer = await generateInvoicePDF(updatedPartner, invoiceId);

    // Upload documents
    console.log('[Manual Agreement] Uploading documents');
    const agreementFilename = `agreement_${partnerId}_${Date.now()}.pdf`;
    const invoiceFilename = `invoice_${partnerId}_${invoiceId}_${Date.now()}.pdf`;

    const [agreementUpload, invoiceUpload] = await Promise.all([
      pratimaClient.uploadFile(pdfBuffer, agreementFilename, 'application/pdf'),
      pratimaClient.uploadFile(invoiceBuffer, invoiceFilename, 'application/pdf')
    ]);

    const agreementUrl = agreementUpload.url;
    const invoiceUrl = invoiceUpload.url;

    console.log('[Manual Agreement] Documents uploaded:', {
      agreementUrl,
      invoiceUrl
    });

    // Prepare payment details object
    const formattedPaymentDetails = {
      order_id: paymentDetails.order_id || `manual_${partnerId}_${Date.now()}`,
      order_amount: paymentDetails.order_amount || '2950',
      order_currency: paymentDetails.order_currency || 'INR',
      payment_id: paymentDetails.payment_id || null,
      payment_status: 'SUCCESS',
      payment_time: paymentDetails.payment_time || new Date().toISOString(),
      payment_method: paymentDetails.payment_method || 'MANUAL',
      upi_id: paymentDetails.upi_id || null,
      bank_reference: paymentDetails.bank_reference || null,
      payment_message: paymentDetails.payment_message || 'Manual completion by admin',
      created_at: paymentDetails.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'SUCCESS',
      manual_completion: true,
      completed_by: 'admin'
    };

    // Update partner status to confirmed
    await partnerRepo.update(partnerId, {
      status: 'confirmed',
      agreement_url: agreementUrl,
      invoice_url: invoiceUrl,
      invoice_id: invoiceId,
      payment_details: formattedPaymentDetails
    });

    console.log('[Manual Agreement] Partner confirmed:', {
      partnerId: partnerId.toString(),
      invoiceId
    });

    // Send confirmation emails
    try {
      await sendManualCompletionEmails(
        updatedPartner,
        pdfBuffer,
        invoiceBuffer,
        invoiceId,
        agreementUrl,
        invoiceUrl
      );
    } catch (emailErr) {
      console.error('[Manual Agreement] Failed to send emails:', emailErr);
      // Don't fail the operation if email fails
    }

    return {
      success: true,
      message: 'Agreement completed successfully',
      partnerId: partnerId.toString(),
      agreement_url: agreementUrl,
      invoice_url: invoiceUrl,
      invoice_id: invoiceId
    };
  } finally {
    // Secure clear sensitive data
    if (plainIdNumber) {
      plainIdNumber = secureClear(plainIdNumber);
      plainIdNumber = null;
    }
    if (plainIdType) {
      plainIdType = secureClear(plainIdType);
      plainIdType = null;
    }

    if (global.gc) {
      global.gc();
    }

    console.log('[Manual Agreement] Sensitive data cleared from memory');
  }
}

/**
 * Send confirmation emails after manual completion
 */
async function sendManualCompletionEmails(
  partner,
  agreementBuffer,
  invoiceBuffer,
  invoiceId,
  agreementUrl,
  invoiceUrl
) {
  const emailService = require('../../email/emailService');
  const partnerId = partner.id.toString();
  const partnerEmail = partner.email;
  const partnerName = partner.name;

  // Email to Partner
  const partnerHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to Homecarehelp, ${partnerName}!</h2>
      <p>Thank you for registering as a service partner. Your payment of ₹2,950 has been received and verified.</p>
      <p>Your service kit (ID card, T-shirt, documents) will be dispatched to your registered address shortly.</p>
      <p>Please find attached:</p>
      <ul>
        <li>Service Partner Agreement (Agreement ID: ${partner.agreement_id})</li>
        <li>Payment Invoice (Invoice No: ${invoiceId})</li>
      </ul>
      <p>You can also download these documents from your partner dashboard.</p>
      <p>If you have any questions, reach out to us at <a href="mailto:support@homecarehelp.com">support@homecarehelp.com</a>.</p>
      <br/>
      <p>Regards,<br/>Team Homecarehelp</p>
    </div>
  `;

  await emailService.sendMail({
    to: partnerEmail,
    subject: 'Registration Confirmed – Welcome to Homecarehelp',
    html: partnerHtml,
    attachments: [
      {
        filename: `Homecarehelp_Service_Agreement_${partnerId}.pdf`,
        content: agreementBuffer,
        contentType: 'application/pdf'
      },
      {
        filename: `Invoice_${invoiceId}.pdf`,
        content: invoiceBuffer,
        contentType: 'application/pdf'
      }
    ]
  });

  // Internal notification
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'support@homecarehelp.com';
  const adminHtml = `
    <div style="font-family: Arial, sans-serif;">
      <h2>Partner Registration Completed Manually</h2>
      <p><strong>Partner ID:</strong> ${partnerId}</p>
      <p><strong>Name:</strong> ${partnerName}</p>
      <p><strong>Email:</strong> ${partnerEmail}</p>
      <p><strong>Phone:</strong> ${partner.phone_number}</p>
      <p><strong>Working City:</strong> ${partner.working_city}</p>
      <p><strong>Agreement ID:</strong> ${partner.agreement_id}</p>
      <p><strong>Invoice ID:</strong> ${invoiceId}</p>
      <p><strong>Agreement URL:</strong> <a href="${agreementUrl}">Download Agreement</a></p>
      <p><strong>Invoice URL:</strong> <a href="${invoiceUrl}">Download Invoice</a></p>
      <br/>
      <p><em>⚠️ This registration was completed manually by admin. Please verify payment details and process welcome kit dispatch.</em></p>
    </div>
  `;

  await emailService.sendMail({
    to: adminEmail,
    subject: `Manual Partner Registration – ${partnerName} (ID: ${partnerId})`,
    html: adminHtml,
    attachments: [
      {
        filename: `Agreement_${partnerId}.pdf`,
        content: agreementBuffer,
        contentType: 'application/pdf'
      },
      {
        filename: `Invoice_${invoiceId}.pdf`,
        content: invoiceBuffer,
        contentType: 'application/pdf'
      }
    ]
  });

  console.log('[Email] Manual completion emails sent successfully', {
    partnerId,
    invoiceId
  });
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
  manuallyCompleteAgreement,
};