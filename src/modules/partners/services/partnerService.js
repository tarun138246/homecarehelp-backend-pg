const fs = require('fs').promises;
const path = require('path');
const partnerRepo = require('../repositories/partnerRepository');
const { encrypt } = require('../../../common/utils/crypto');
const { generateAgreementPDF } = require('../../../common/utils/agreementPdf');
const { generateAgreementId, verifyAgreementId } = require('../../../common/utils/agreementId');
const cashfreePaymentService = require('../../payments/services/cashfreePaymentService');
const pratimaClient = require('../../../common/utils/pratimaClient');
const partnerSessions = require('./partnerSessionStore');
const env = require('../../../common/config/env');

const JOINING_FEE = '2950';
const ORDER_PREFIX = 'ptn';
const REQUIRED_FIELDS = ['name', 'email', 'phone_number', 'working_city', 'pincode', 'address', 'selected_services', 'id_proof'];

// Signature/PDF are held in RAM (via partnerSessionStore) for speed, and
// mirrored to disk so a server restart between e-sign and payment
// confirmation doesn't lose them. A daily cron prunes anything stale.

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

  // Each ID-proof number gets its own independent key+IV, stored alongside
  // it in the same array element — one item's key can never decode another.
  const idProofs = partnerData.id_proof.map((item) => {
    const { encryptedData, key, iv } = encrypt(item.number);
    return { name: item.name, number: encryptedData, key, iv };
  });

  // `address` and `selected_services` are plain String columns on the
  // partners table (schema not touched) — serialize structured input.
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

  // The agreement ID is assigned once and reused on every re-sign so it
  // stays permanent for this partner's agreement.
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

// Verifies an agreement ID printed on (or extracted from) a signed
// agreement PDF. Checks the ID's own HMAC checksum first (catches a forged
// or hand-edited ID without touching the DB), then confirms it actually
// belongs to a partner record on file.
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

async function loadAgreementPdf(partnerId) {
  const session = partnerSessions.get(partnerId);
  if (session?.pdfBuffer) return session.pdfBuffer;

  // RAM was cleared (e.g. restart) — fall back to the disk copy written at e-sign time.
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

exports.createPartnerOrder = async (partnerId) => {
  if (!partnerId) throw Object.assign(new Error('partner_id is required'), { status: 400 });

  const partner = await partnerRepo.findById(partnerId);
  if (!partner) throw Object.assign(new Error('Partner not found'), { status: 404 });

  return cashfreePaymentService.createOrder({
    prefix: ORDER_PREFIX,
    entityId: partnerId.toString(),
    amount: JOINING_FEE,
    customerName: partner.name,
    customerEmail: partner.email,
    customerPhone: partner.phone_number
  });
};

exports.confirmPartnerOrder = async (orderId) => {
  if (!orderId) throw Object.assign(new Error('orderId is required'), { status: 400 });

  const result = await cashfreePaymentService.confirmOrder({ orderId, expectedPrefix: ORDER_PREFIX });

  if (result.order_status !== 'PAID') {
    return { paid: false, order_status: result.order_status };
  }

  const partnerId = result.entityId;
  const pdfBuffer = await loadAgreementPdf(partnerId);
  if (!pdfBuffer) {
    throw Object.assign(new Error('Signed agreement not found — please e-sign again'), { status: 409 });
  }

  const agreementUrl = await uploadAgreementPDF(pdfBuffer, partnerId);

  await partnerRepo.update(partnerId, {
    status: 'confirmed',
    agreement_url: agreementUrl,
    payment_details: {
      order_id: result.order_id,
      payment_session_id: result.payment_session_id,
      amount: result.order_amount,
      payment_methods: result.payment_methods,
      paidAt: new Date().toISOString()
    }
  });

  await clearAgreementTemp(partnerId);

  return { paid: true, message: 'Partner confirmed', agreement_url: agreementUrl };
};

// Uploads the signed agreement PDF to the Pratima custom file-storage engine
// and returns its public URL.
async function uploadAgreementPDF(pdfBuffer, partnerId) {
  const filename = `agreement_${partnerId}_${Date.now()}.pdf`;
  const { url } = await pratimaClient.uploadFile(pdfBuffer, filename, 'application/pdf');
  return url;
}

// Called by the daily cleanup cron. Removes RAM sessions and temp disk files
// for partners who e-signed but never completed payment within maxAgeMs —
// otherwise both would accumulate forever.
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
    return removed; // temp dir doesn't exist yet — nothing to prune on disk
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
