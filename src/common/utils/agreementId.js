const crypto = require('crypto');
const env = require('../config/env');

const PREFIX = 'HCH';
const AGREEMENT_ID_RE = /^HCH-(\d+)-([0-9a-f]{8})-([0-9a-f]{8})$/;

// Checksum is an HMAC over partnerId+random, keyed with the server's JWT
// secret. Only someone holding that secret can produce an ID that passes
// verifyAgreementId, so a tampered/forged ID is detectable without a DB hit.
function computeChecksum(partnerId, random) {
  return crypto
    .createHmac('sha256', env.jwtSecret || 'dev-agreement-secret')
    .update(`${partnerId}:${random}`)
    .digest('hex')
    .slice(0, 8);
}

// Generates a permanent agreement ID for a partner. Call once per partner
// (at first e-sign) and persist it — never regenerate for the same partner.
function generateAgreementId(partnerId) {
  const random = crypto.randomBytes(4).toString('hex');
  const checksum = computeChecksum(partnerId, random);
  return `${PREFIX}-${partnerId}-${random}-${checksum}`;
}

// Recomputes the checksum from the ID's own parts and compares — detects any
// tampering with the partner id, random segment, or checksum itself.
function verifyAgreementId(agreementId) {
  if (typeof agreementId !== 'string') return { valid: false };

  const match = agreementId.match(AGREEMENT_ID_RE);
  if (!match) return { valid: false };

  const [, partnerId, random, checksum] = match;
  const expected = computeChecksum(partnerId, random);

  const valid = checksum.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(checksum), Buffer.from(expected));

  return valid ? { valid: true, partnerId } : { valid: false };
}

function generateInvoiceId(partnerId) {
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  const checksum = crypto
    .createHmac('sha256', env.jwtSecret || 'dev-agreement-secret')
    .update(`INV:${partnerId}:${random}`)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();
  return `INV-HCH-${partnerId}-${random}-${checksum}`;
}

module.exports = { generateAgreementId, verifyAgreementId, generateInvoiceId };