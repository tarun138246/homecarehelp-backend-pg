const fs = require('fs').promises;
const path = require('path');
const partnerRepo = require('../repositories/partnerRepository');
const { encrypt, decrypt } = require('../../../common/utils/crypto');
const { generateAgreementPDF } = require('../../../common/utils/agreementPdf');
const { generateAgreementId, verifyAgreementId, generateInvoiceId } = require('../../../common/utils/agreementId');
const cashfreePaymentService = require('../../payments/services/cashfreePaymentService');
const { generateInvoicePDF } = require('../../../common/utils/invoicePdf');
const pratimaClient = require('../../../common/utils/pratimaClient');
const partnerSessions = require('./partnerSessionStore');
const env = require('../../../common/config/env');
const { captureException, captureMessage } = require('../../../common/config/sentry');
const { secureClear } = require('../../../common/utils/memoryCleanup');

const JOINING_FEE = '2950';
const ORDER_PREFIX = 'ptn';
const REQUIRED_FIELDS = ['name', 'email', 'phone_number', 'working_city', 'pincode', 'address', 'selected_services', 'id_proof'];

// Valid ID types (standardized)
const VALID_ID_TYPES = ['PAN', 'AADHAR', 'DL'];

// Mapping for common ID type variations (case-insensitive)
const ID_TYPE_MAP = {
  'PAN': 'PAN',
  'PAN CARD': 'PAN',
  'PANCARD': 'PAN',
  'AADHAR': 'AADHAR',
  'AADHAAR': 'AADHAR',
  'AADHAR CARD': 'AADHAR',
  'AADHAAR CARD': 'AADHAR',
  'AADHARCARD': 'AADHAR',
  'AADHAARCARD': 'AADHAR',
  'DL': 'DL',
  'DRIVING LICENSE': 'DL',
  'DRIVING LICENCE': 'DL',
  'DRIVING': 'DL',
  'DRIVING LICENSE CARD': 'DL',
  'DRIVER LICENSE': 'DL',
  'DRIVER LICENCE': 'DL'
};

const ID_VALIDATION_PATTERNS = {
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  AADHAR: /^\d{12}$/,
  DL: /^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/
};

function tempDir() {
  return path.resolve(env.agreementTempDir);
}

function tempPdfPath(partnerId) {
  return path.join(tempDir(), `${partnerId}.pdf`);
}

function tempSigPath(partnerId) {
  return path.join(tempDir(), `${partnerId}.sig`);
}

function validateRegistration(data) {
  for (const field of REQUIRED_FIELDS) {
    if (!data[field]) {
      throw Object.assign(new Error(`${field} is required`), { status: 400 });
    }
  }
  if (!Array.isArray(data.id_proof) || data.id_proof.length === 0) {
    throw Object.assign(new Error('id_proof must be a non-empty array'), { status: 400 });
  }
  for (const item of data.id_proof) {
    if (!item.name || !item.number) {
      throw Object.assign(new Error('Each id_proof item requires name and number'), { status: 400 });
    }
  }
}

/**
 * Validates and normalizes ID proofs
 * Handles case-insensitive matching and common variations
 */
function validateIdProofs(idProofs) {
  const validIdProofs = [];
  
  for (const item of idProofs) {
    if (!item.name || !item.number) {
      throw Object.assign(
        new Error('Each id_proof item requires name and number'), 
        { status: 400 }
      );
    }
    
    // Normalize: trim whitespace, convert to uppercase
    const normalizedInput = item.name.trim().toUpperCase();
    
    // Find the standardized ID type from mapping or direct match
    let idType = ID_TYPE_MAP[normalizedInput] || normalizedInput;
    
    // Debug logging (remove in production if needed)
    console.log('[ID Validation]', {
      original: item.name,
      normalized: normalizedInput,
      mapped: idType
    });
    
    // Validate it's one of the accepted types
    if (!VALID_ID_TYPES.includes(idType)) {
      // Provide a helpful error message
      const validOptions = VALID_ID_TYPES.map(t => {
        switch(t) {
          case 'PAN': return 'PAN Card';
          case 'AADHAR': return 'Aadhaar Card';
          case 'DL': return 'Driving License';
          default: return t;
        }
      }).join(', ');
      
      throw Object.assign(
        new Error(`Invalid ID type: "${item.name}". Please use one of: ${validOptions}`), 
        { status: 400 }
      );
    }
    
    // Validate ID number format based on type
    const pattern = ID_VALIDATION_PATTERNS[idType];
    if (!pattern.test(item.number.trim())) {
      let formatHint = '';
      switch(idType) {
        case 'PAN':
          formatHint = 'Format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)';
          break;
        case 'AADHAR':
          formatHint = 'Format: 12 digits (e.g., 123456789012)';
          break;
        case 'DL':
          formatHint = 'Format: 2 letters + 2 digits + 4 digits + 7 digits (e.g., MH0120200000001)';
          break;
      }
      throw Object.assign(
        new Error(`Invalid ${idType} number format: "${item.number}". ${formatHint}`), 
        { status: 400 }
      );
    }
    
    // Store with standardized name (uppercase)
    validIdProofs.push({
      name: idType,  // Always store as PAN, AADHAR, or DL
      number: item.number.trim()
    });
  }
  
  return validIdProofs;
}

exports.register = async (partnerData) => {
  validateRegistration(partnerData);

  // Validate ID proofs (now handles case-insensitive matching)
  const validIdProofs = validateIdProofs(partnerData.id_proof);

  const idProofs = validIdProofs.map((item) => {
    try {
      const { encryptedData, iv, keyUsed } = encrypt(item.number);
      return { 
        name: item.name, 
        number: encryptedData, 
        iv,
        keyUsed // Store 1 or 2 instead of full key
      };
    } catch (encryptError) {
      console.error('[Encryption Error]', {
        idType: item.name,
        error: encryptError.message
      });
      throw Object.assign(
        new Error('Unable to secure ID proof data. Please try again.'), 
        { status: 500 }
      );
    }
  });

  const address = typeof partnerData.address === 'string'
    ? partnerData.address
    : JSON.stringify(partnerData.address);
  const selected_services = typeof partnerData.selected_services === 'string'
    ? partnerData.selected_services
    : JSON.stringify(partnerData.selected_services);

  const partner = await partnerRepo.create({
    name: partnerData.name,
    email: partnerData.email,
    phone_number: partnerData.phone_number,
    working_city: partnerData.working_city,
    pincode: partnerData.pincode,
    address,
    selected_services,
    id_proof: idProofs,
    agreement_url: '',
    payment_details: {},
    data_collection_consent: { accepted: false, timestamp: null },
    status: 'created'
  });

  console.log('[Partner] Registered:', {
    partnerId: partner.id.toString(),
    email: partner.email,
    phone: partner.phone_number
  });

  return { partnerId: partner.id.toString() };
};

exports.eSign = async (partnerId, signatureBase64) => {
  if (!partnerId || !signatureBase64) {
    throw Object.assign(new Error('partnerId and signature are required'), { status: 400 });
  }

  let partner = await partnerRepo.findById(partnerId);
  if (!partner) throw Object.assign(new Error('Partner not found'), { status: 404 });

  if (!partner.agreement_id) {
    const agreementId = generateAgreementId(partner.id.toString());
    partner = await partnerRepo.update(partnerId, { agreement_id: agreementId });
  }

  // Decrypt the ID number temporarily in RAM
  let plainIdNumber = null;
  let plainIdType = null;
  
  try {
    if (partner.id_proof && partner.id_proof.length > 0) {
      const primaryProof = partner.id_proof[0]; // Use first ID proof
      plainIdType = primaryProof.name;
      
      // Decrypt the ID number using the stored key reference
      plainIdNumber = decrypt(primaryProof.number, primaryProof.keyUsed, primaryProof.iv);
      
      console.log('[eSign] ID decrypted temporarily for agreement generation:', {
        partnerId: partnerId.toString(),
        idType: plainIdType
      });
    }
  } catch (decryptError) {
    console.error('[eSign] Failed to decrypt ID number:', decryptError);
    // Continue without ID number if decryption fails
    plainIdNumber = null;
    plainIdType = null;
  }

  try {
    // Pass plain ID to PDF generator - it exists only in RAM
    const pdfBuffer = await generateAgreementPDF(partner, signatureBase64, plainIdType, plainIdNumber);

    // Store session with the encrypted partner data (not plain ID)
    partnerSessions.set(partnerId, signatureBase64, pdfBuffer);

    await fs.mkdir(tempDir(), { recursive: true });
    await Promise.all([
      fs.writeFile(tempPdfPath(partnerId), pdfBuffer),
      fs.writeFile(tempSigPath(partnerId), signatureBase64, 'utf8')
    ]);

    console.log('[eSign] Agreement generated successfully:', {
      partnerId: partnerId.toString()
    });

    return { message: 'Signature received, agreement generated' };
  } finally {
    // Secure clear: overwrite with garbage before nullifying
    if (plainIdNumber) {
      plainIdNumber = secureClear(plainIdNumber);
      plainIdNumber = null;
    }
    if (plainIdType) {
      plainIdType = secureClear(plainIdType);
      plainIdType = null;
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    console.log('[eSign] Plain ID securely cleared from RAM:', {
      partnerId: partnerId.toString()
    });
  }
};

exports.verifyAgreement = async (agreementId) => {
  const check = verifyAgreementId(agreementId);
  if (!check.valid) {
    return { valid: false, reason: 'Agreement ID is invalid or has been tampered with' };
  }

  const partner = await partnerRepo.findByAgreementId(agreementId);
  if (!partner || partner.id.toString() !== check.partnerId) {
    return { valid: false, reason: 'Agreement ID not found in our records' };
  }

  return {
    valid: true,
    agreementId,
    partnerName: partner.name,
    phoneMasked: partner.phone_number.replace(/^(\d{2})\d+(\d{2})$/, '$1******$2'),
    workingCity: partner.working_city,
    status: partner.status
  };
};

exports.createPartnerOrder = async (partnerId) => {
  if (!partnerId) throw Object.assign(new Error('partner_id is required'), { status: 400 });

  const partner = await partnerRepo.findById(partnerId);
  if (!partner) throw Object.assign(new Error('Partner not found'), { status: 404 });

  console.log('[Create Order] Started:', {
    partnerId: partnerId.toString(),
    currentStatus: partner.status,
    existingOrderId: partner.payment_details?.order_id || 'none'
  });

  const order = await cashfreePaymentService.createOrder({
    prefix: ORDER_PREFIX,
    entityId: partnerId.toString(),
    amount: JOINING_FEE,
    customerName: partner.name,
    customerEmail: partner.email,
    customerPhone: partner.phone_number
  });

  console.log('[Create Order] Cashfree order created:', {
    partnerId: partnerId.toString(),
    orderId: order.order_id,
    paymentSessionId: order.payment_session_id
  });

  // Store only the latest order attempt
  const paymentDetails = {
    order_id: order.order_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'PENDING'
  };

  await partnerRepo.update(partnerId, {
    payment_details: paymentDetails,
    status: 'payment_initiated'
  });

  console.log('[Create Order] Partner updated with order details:', {
    partnerId: partnerId.toString(),
    orderId: order.order_id
  });

  return order;
};

exports.confirmPartnerOrder = async (orderId) => {
  if (!orderId) throw Object.assign(new Error('orderId is required'), { status: 400 });

  const partner = await partnerRepo.findByOrderId(orderId);
  if (!partner) {
    throw Object.assign(new Error('Order not found'), { status: 404 });
  }

  const paymentDetails = partner.payment_details;

  if (!paymentDetails || paymentDetails.order_id !== orderId) {
    return { status: 'failed', message: 'Order not found in partner records' };
  }

  if (paymentDetails.status === 'SUCCESS') {
    return { 
      status: 'success', 
      message: 'Payment successful',
      agreement_url: partner.agreement_url,
      invoice_url: partner.invoice_url,
      invoice_id: partner.invoice_id
    };
  } else {
    return { 
      status: 'failed', 
      message: `Payment ${paymentDetails.status.toLowerCase()}` 
    };
  }
};

exports.processWebhook = async (webhookData) => {
  const { type, data } = webhookData;
  
  console.log('[Webhook Processing] Started:', {
    type,
    orderId: data?.order?.order_id,
    timestamp: new Date().toISOString()
  });
  
  if (!data?.order?.order_id) {
    console.error('[Webhook Processing] Invalid webhook data - missing order_id');
    throw Object.assign(new Error('Invalid webhook data'), { status: 400 });
  }

  const orderId = data.order.order_id;
  const partner = await partnerRepo.findByOrderId(orderId);
  
  if (!partner) {
    console.error('[Webhook Processing] Partner not found:', { orderId });
    throw Object.assign(new Error('Partner not found for this order'), { status: 404 });
  }

  console.log('[Webhook Processing] Partner found:', {
    partnerId: partner.id.toString(),
    currentStatus: partner.status,
    storedOrderId: partner.payment_details?.order_id
  });

  // Verify this is the latest order
  if (partner.payment_details?.order_id !== orderId) {
    console.warn('[Webhook Processing] Not the latest order:', {
      webhookOrderId: orderId,
      latestOrderId: partner.payment_details?.order_id,
      partnerId: partner.id.toString()
    });
    throw Object.assign(
      new Error('This is not the latest order for this partner'),
      { status: 409 }
    );
  }

  switch (type) {
    case 'PAYMENT_SUCCESS_WEBHOOK':
      return await handlePaymentSuccess(partner, data);
    
    case 'PAYMENT_FAILED_WEBHOOK':
      return await handlePaymentFailed(partner, data);
    
    case 'PAYMENT_USER_DROPPED_WEBHOOK':
      return await handlePaymentDropped(partner, data);
    
    default:
      console.error('[Webhook Processing] Unsupported webhook type:', { type });
      throw Object.assign(new Error('Unsupported webhook type'), { status: 400 });
  }
};

async function handlePaymentSuccess(partner, data) {
  const { payment, order } = data;
  const partnerId = partner.id.toString();
  
  console.log('[Payment Success] Processing:', {
    partnerId,
    orderId: order.order_id,
    paymentId: payment.cf_payment_id,
    amount: order.order_amount
  });

  // IDEMPOTENCY CHECK: If already processed, return success
  if (partner.payment_details?.payment_id === payment.cf_payment_id) {
    console.log('[Payment Success] Already processed (idempotent):', {
      partnerId,
      paymentId: payment.cf_payment_id
    });
    return { 
      success: true, 
      message: 'Payment already processed',
      idempotent: true
    };
  }

  // Check if partner is already confirmed
  if (partner.status === 'confirmed') {
    console.log('[Payment Success] Partner already confirmed:', {
      partnerId,
      existingPaymentId: partner.payment_details?.payment_id
    });
    return {
      success: true,
      message: 'Partner already confirmed',
      agreement_url: partner.agreement_url,
      invoice_url: partner.invoice_url,
      invoice_id: partner.invoice_id
    };
  }
  
  // Extract payment method type and details
  let paymentMethodType = null;
  let upiId = null;
  
  if (payment.payment_method) {
    if (payment.payment_method.upi) {
      paymentMethodType = 'UPI';
      upiId = payment.payment_method.upi.upi_id || null;
    } else if (payment.payment_method.netbanking) {
      paymentMethodType = 'NET_BANKING';
    } else if (payment.payment_method.card) {
      paymentMethodType = 'CARD';
    }
  }

  // Update payment details with success information
  const paymentDetails = {
    order_id: order.order_id,
    order_amount: order.order_amount,
    order_currency: order.order_currency,
    payment_id: payment.cf_payment_id,
    payment_status: 'SUCCESS',
    payment_time: payment.payment_time,
    payment_method: paymentMethodType,
    upi_id: upiId,
    bank_reference: payment.bank_reference,
    payment_message: payment.payment_message,
    created_at: partner.payment_details.created_at,
    updated_at: new Date().toISOString(),
    status: 'SUCCESS'
  };

  // Generate agreement and invoice
  const pdfBuffer = await loadAgreementPdf(partnerId);
  
  if (!pdfBuffer) {
    console.error('[Payment Success] Agreement PDF not found:', {
      partnerId,
      orderId: order.order_id
    });

    // Update status to indicate payment received but documents missing
    await partnerRepo.update(partnerId, {
      status: 'payment_received_pending_documents',
      payment_details: paymentDetails
    });

    // TODO: Add alerting system (email, Slack notification)
    // TODO: Add to retry queue for document generation
    
    console.error('[Payment Success] ALERT: Payment received but agreement PDF missing', {
      partnerId,
      email: partner.email,
      phone: partner.phone_number,
      amount: order.order_amount
    });

    return { 
      success: false,
      error: 'DOCUMENTS_MISSING',
      message: 'Payment received but agreement not found',
      requires_manual_intervention: true,
      partnerId,
      paymentId: payment.cf_payment_id
    };
  }

  console.log('[Payment Success] Generating invoice:', { partnerId });
  const invoiceId = generateInvoiceId(partnerId);
  const invoiceBuffer = await generateInvoicePDF(partner, invoiceId);
  
  console.log('[Payment Success] Uploading documents:', { partnerId });
  const [agreementUrl, invoiceUrl] = await Promise.all([
    uploadAgreementPDF(pdfBuffer, partnerId),
    uploadInvoicePDF(invoiceBuffer, partnerId, invoiceId)
  ]);

  console.log('[Payment Success] Documents uploaded:', {
    partnerId,
    agreementUrl,
    invoiceUrl
  });

  await partnerRepo.update(partnerId, {
    status: 'confirmed',
    agreement_url: agreementUrl,
    invoice_url: invoiceUrl,
    invoice_id: invoiceId,
    payment_details: paymentDetails
  });

  console.log('[Payment Success] Partner confirmed:', {
    partnerId,
    invoiceId,
    paymentId: payment.cf_payment_id
  });

  await clearAgreementTemp(partnerId);

  return { 
    success: true, 
    message: 'Payment confirmed and documents generated',
    agreement_url: agreementUrl,
    invoice_url: invoiceUrl,
    invoice_id: invoiceId
  };
}

async function handlePaymentFailed(partner, data) {
  const { payment, order } = data;
  const partnerId = partner.id.toString();

  console.log('[Payment Failed]:', {
    partnerId,
    orderId: order.order_id,
    paymentId: payment.cf_payment_id,
    reason: payment.payment_message
  });

  // IDEMPOTENCY CHECK
  if (partner.payment_details?.payment_id === payment.cf_payment_id &&
      partner.payment_details?.payment_status === 'FAILED') {
    console.log('[Payment Failed] Already processed (idempotent):', {
      partnerId,
      paymentId: payment.cf_payment_id
    });
    return { success: true, message: 'Payment failed status already recorded' };
  }

  const paymentDetails = {
    order_id: order.order_id,
    order_amount: order.order_amount,
    order_currency: order.order_currency,
    payment_id: payment.cf_payment_id,
    payment_status: 'FAILED',
    payment_time: payment.payment_time,
    payment_message: payment.payment_message,
    created_at: partner.payment_details.created_at,
    updated_at: new Date().toISOString(),
    status: 'FAILED'
  };

  await partnerRepo.update(partnerId, {
    status: 'payment_failed',
    payment_details: paymentDetails
  });

  console.log('[Payment Failed] Status updated:', {
    partnerId,
    paymentId: payment.cf_payment_id
  });

  return { success: true, message: 'Payment failed status updated' };
}

async function handlePaymentDropped(partner, data) {
  const { payment, order } = data;
  const partnerId = partner.id.toString();

  console.log('[Payment Dropped]:', {
    partnerId,
    orderId: order.order_id,
    paymentId: payment.cf_payment_id
  });

  // IDEMPOTENCY CHECK
  if (partner.payment_details?.payment_id === payment.cf_payment_id &&
      partner.payment_details?.payment_status === 'USER_DROPPED') {
    console.log('[Payment Dropped] Already processed (idempotent):', {
      partnerId,
      paymentId: payment.cf_payment_id
    });
    return { success: true, message: 'Payment dropped status already recorded' };
  }

  const paymentDetails = {
    order_id: order.order_id,
    order_amount: order.order_amount,
    order_currency: order.order_currency,
    payment_id: payment.cf_payment_id,
    payment_status: 'USER_DROPPED',
    payment_time: payment.payment_time,
    payment_message: payment.payment_message,
    created_at: partner.payment_details.created_at,
    updated_at: new Date().toISOString(),
    status: 'USER_DROPPED'
  };

  await partnerRepo.update(partnerId, {
    status: 'payment_dropped',
    payment_details: paymentDetails
  });

  console.log('[Payment Dropped] Status updated:', {
    partnerId,
    paymentId: payment.cf_payment_id
  });

  return { success: true, message: 'Payment dropped status updated' };
}

// Cron job to reset stale payment attempts
exports.resetStalePayments = async () => {
  const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
  
  const stalePartners = await partnerRepo.findStalePayments(cutoffTime);
  
  let resetCount = 0;
  for (const partner of stalePartners) {
    await partnerRepo.resetPaymentDetails(partner.id.toString());
    resetCount++;
  }

  return { success: true, message: `Reset ${resetCount} stale payment attempts` };
};

async function loadAgreementPdf(partnerId) {
  const session = partnerSessions.get(partnerId);
  if (session?.pdfBuffer) return session.pdfBuffer;

  try {
    return await fs.readFile(tempPdfPath(partnerId));
  } catch {
    return null;
  }
}

async function clearAgreementTemp(partnerId) {
  partnerSessions.delete(partnerId);
  await Promise.allSettled([
    fs.unlink(tempPdfPath(partnerId)),
    fs.unlink(tempSigPath(partnerId))
  ]);
}

async function uploadAgreementPDF(pdfBuffer, partnerId) {
  const filename = `agreement_${partnerId}_${Date.now()}.pdf`;
  const { url } = await pratimaClient.uploadFile(pdfBuffer, filename, 'application/pdf');
  return url;
}

async function uploadInvoicePDF(invoiceBuffer, partnerId, invoiceId) {
  const filename = `invoice_${partnerId}_${invoiceId}_${Date.now()}.pdf`;
  const { url } = await pratimaClient.uploadFile(invoiceBuffer, filename, 'application/pdf');
  return url;
}

exports.pruneStaleAgreements = async (maxAgeMs) => {
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;

  for (const [partnerId, session] of partnerSessions.entries()) {
    if (session.createdAt < cutoff) {
      partnerSessions.delete(partnerId);
      removed++;
    }
  }

  let dir;
  try {
    dir = await fs.readdir(tempDir());
  } catch {
    return removed;
  }

  for (const file of dir) {
    if (!file.endsWith('.pdf') && !file.endsWith('.sig')) continue;
    const filePath = path.join(tempDir(), file);
    try {
      const stat = await fs.stat(filePath);
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(filePath);
        removed++;
      }
    } catch {
      // file removed concurrently — ignore
    }
  }

  return removed;
};