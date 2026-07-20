const fs = require('fs').promises;
const path = require('path');
const partnerRepo = require('../repositories/partnerRepository');
const { encrypt } = require('../../../common/utils/crypto');
const { generateAgreementPDF } = require('../../../common/utils/agreementPdf');
const { generateAgreementId, verifyAgreementId, generateInvoiceId } = require('../../../common/utils/agreementId');
const cashfreePaymentService = require('../../payments/services/cashfreePaymentService');
const { generateInvoicePDF } = require('../../../common/utils/invoicePdf');
const pratimaClient = require('../../../common/utils/pratimaClient');
const partnerSessions = require('./partnerSessionStore');
const env = require('../../../common/config/env');

const JOINING_FEE = '2950';
const ORDER_PREFIX = 'ptn';
const REQUIRED_FIELDS = ['name', 'email', 'phone_number', 'working_city', 'pincode', 'address', 'selected_services', 'id_proof'];

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

exports.register = async (partnerData) => {
  validateRegistration(partnerData);

  const idProofs = partnerData.id_proof.map((item) => {
    const { encryptedData, key, iv } = encrypt(item.number);
    return { name: item.name, number: encryptedData, key, iv };
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
    data_collection_consent: 0,
    status: 'created'
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

  const pdfBuffer = await generateAgreementPDF(partner, signatureBase64);

  partnerSessions.set(partnerId, signatureBase64, pdfBuffer);

  await fs.mkdir(tempDir(), { recursive: true });
  await Promise.all([
    fs.writeFile(tempPdfPath(partnerId), pdfBuffer),
    fs.writeFile(tempSigPath(partnerId), signatureBase64, 'utf8')
  ]);

  return { message: 'Signature received, agreement generated' };
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

  const order = await cashfreePaymentService.createOrder({
    prefix: ORDER_PREFIX,
    entityId: partnerId.toString(),
    amount: JOINING_FEE,
    customerName: partner.name,
    customerEmail: partner.email,
    customerPhone: partner.phone_number
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
      invoice_url: partner.invoice_url
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
  
  if (!data?.order?.order_id) {
    throw Object.assign(new Error('Invalid webhook data'), { status: 400 });
  }

  const orderId = data.order.order_id;
  const partner = await partnerRepo.findByOrderId(orderId);
  
  if (!partner) {
    throw Object.assign(new Error('Partner not found for this order'), { status: 404 });
  }

  // Verify this is the latest order
  if (partner.payment_details?.order_id !== orderId) {
    throw Object.assign(new Error('This is not the latest order for this partner'), { status: 409 });
  }

  switch (type) {
    case 'PAYMENT_SUCCESS_WEBHOOK':
      return await handlePaymentSuccess(partner, data);
    
    case 'PAYMENT_FAILED_WEBHOOK':
      return await handlePaymentFailed(partner, data);
    
    case 'PAYMENT_USER_DROPPED_WEBHOOK':
      return await handlePaymentDropped(partner, data);
    
    default:
      throw Object.assign(new Error('Unsupported webhook type'), { status: 400 });
  }
};

async function handlePaymentSuccess(partner, data) {
  const { payment, order } = data;
  
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
  const partnerId = partner.id.toString();
  const pdfBuffer = await loadAgreementPdf(partnerId);
  
  if (!pdfBuffer) {
    await partnerRepo.update(partnerId, {
      status: 'payment_received',
      payment_details: paymentDetails
    });
    
    return { 
      success: true, 
      message: 'Payment received but agreement not found',
      requires_esign: true 
    };
  }

  const invoiceId = generateInvoiceId(partnerId);
  const invoiceBuffer = await generateInvoicePDF(partner, invoiceId);
  
  const [agreementUrl, invoiceUrl] = await Promise.all([
    uploadAgreementPDF(pdfBuffer, partnerId),
    uploadInvoicePDF(invoiceBuffer, partnerId, invoiceId)
  ]);

  await partnerRepo.update(partnerId, {
    status: 'confirmed',
    agreement_url: agreementUrl,
    invoice_url: invoiceUrl,
    invoice_id: invoiceId,
    payment_details: paymentDetails
  });

  await clearAgreementTemp(partnerId);

  return { 
    success: true, 
    message: 'Payment confirmed and documents generated',
    agreement_url: agreementUrl,
    invoice_url: invoiceUrl
  };
}

async function handlePaymentFailed(partner, data) {
  const { payment, order } = data;

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

  await partnerRepo.update(partner.id.toString(), {
    status: 'payment_failed',
    payment_details: paymentDetails
  });

  return { success: true, message: 'Payment failed status updated' };
}

async function handlePaymentDropped(partner, data) {
  const { payment, order } = data;

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

  await partnerRepo.update(partner.id.toString(), {
    status: 'payment_dropped',
    payment_details: paymentDetails
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