const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');

// Logo setup
const logoPath = path.join(__dirname, '..', '..', '..', 'assets', 'logo.png');
let LOGO_BASE64 = '';

try {
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    const ext = path.extname(logoPath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    LOGO_BASE64 = `data:${mimeType};base64,${logoBuffer.toString('base64')}`;
  }
} catch (err) {
  console.warn('Logo file not found for invoice, using fallback:', err.message);
}

// Company Details
const COMPANY_DETAILS = {
  name: 'Homecarehelp',
  address: '644 Prem Ganj Sipri Bazar',
  city: 'Jhansi',
  state: 'Uttar Pradesh',
  pincode: '284003',
  phone: '+91 8354070809',
  email: 'support@homecarehelp.com',
  gstin: '09AABCG1234R1Z5', // Replace with actual GSTIN
  website: 'www.homecarehelp.com',
  stateCode: '09'
};

const JOINING_FEE = '2950';
const COMPANY_STATE = 'Uttar Pradesh'; // Your company's state

async function generateInvoicePDF(partner, invoiceId) {
  const now = new Date();
  const invoiceDate = now.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const html = buildInvoiceHtml(partner, invoiceId, LOGO_BASE64, invoiceDate);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: env.puppeteerExecutablePath || null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

function getPartnerState(partner) {
  try {
    const addressObj = typeof partner.address === 'string' ? JSON.parse(partner.address) : partner.address;
    if (addressObj && addressObj.state) {
      return addressObj.state.trim();
    }
  } catch {}
  
  // Fallback: check if working_city gives any hint (won't be accurate, but better than nothing)
  return null;
}

function isSameState(partner) {
  const partnerState = getPartnerState(partner);
  if (!partnerState) return true; // Default to same state if can't determine
  
  return partnerState.toLowerCase() === COMPANY_STATE.toLowerCase();
}

function buildInvoiceHtml(partner, invoiceId, logoBase64, invoiceDate) {
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="Homecarehelp Logo" style="height: 50px; width: auto;">`
    : `<div style="width: 50px; height: 50px; background: #2563eb; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700;">H</div>`;

  // Parse partner address from DB
  let partnerFullAddress = '';
  
  try {
    const addressObj = typeof partner.address === 'string' ? JSON.parse(partner.address) : partner.address;
    if (addressObj && typeof addressObj === 'object') {
      const parts = [];
      if (addressObj.street) parts.push(addressObj.street);
      if (addressObj.landmark) parts.push(addressObj.landmark);
      if (addressObj.area) parts.push(addressObj.area);
      if (addressObj.city) parts.push(addressObj.city);
      if (addressObj.state) parts.push(addressObj.state);
      partnerFullAddress = parts.join(', ');
      
      // Add pincode if not already in address
      const pincode = addressObj.pincode || partner.pincode || '';
      if (pincode && !partnerFullAddress.includes(pincode)) {
        partnerFullAddress += ` - ${pincode}`;
      }
    }
  } catch {
    // If address is a plain string
    partnerFullAddress = partner.address || '';
    if (partner.pincode && !partnerFullAddress.includes(partner.pincode)) {
      partnerFullAddress += ` - ${partner.pincode}`;
    }
  }
  
  if (!partnerFullAddress) {
    partnerFullAddress = `${partner.working_city || ''} - ${partner.pincode || ''}`;
  }

  const sameState = isSameState(partner);
  const partnerState = getPartnerState(partner) || COMPANY_STATE;
  
  const subtotal = (parseFloat(JOINING_FEE) / 1.18).toFixed(2);
  
  let taxHtml = '';
  if (sameState) {
    // CGST + SGST for same state
    const cgst = (parseFloat(subtotal) * 0.09).toFixed(2);
    const sgst = (parseFloat(subtotal) * 0.09).toFixed(2);
    taxHtml = `
        <tr>
          <td>CGST (9%)</td>
          <td>₹ ${cgst}</td>
        </tr>
        <tr>
          <td>SGST (9%)</td>
          <td>₹ ${sgst}</td>
        </tr>`;
  } else {
    // IGST for different state
    const igst = (parseFloat(subtotal) * 0.18).toFixed(2);
    taxHtml = `
        <tr>
          <td>IGST (18%)</td>
          <td>₹ ${igst}</td>
        </tr>`;
  }
  
  const total = JOINING_FEE;

  // Get payment details from DB
  const paymentDetails = partner.payment_details || {};
  const paymentTime = paymentDetails.payment_time || invoiceDate;
  const paymentMethod = paymentDetails.payment_method || 'Online Payment';
  const paymentId = paymentDetails.payment_id || 'N/A';
  const bankReference = paymentDetails.bank_reference || 'N/A';
  const upiId = paymentDetails.upi_id || '';

  let paymentMethodDisplay = paymentMethod;
  if (paymentMethod === 'UPI' && upiId) {
    paymentMethodDisplay = `UPI (${upiId})`;
  }

  const gstTypeDisplay = sameState ? 'CGST + SGST' : 'IGST';
  const placeOfSupply = sameState ? COMPANY_STATE : partnerState;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceId} - Homecarehelp</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1a1a2e;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    .invoice-container {
      max-width: 190mm;
      margin: 0 auto;
      padding: 15mm 12mm;
      background: #ffffff;
    }

    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10mm;
      padding-bottom: 6mm;
      border-bottom: 2px solid #fa1313;
    }

    .company-info {
      flex: 1;
    }

    .company-logo {
      margin-bottom: 3mm;
    }

    .company-name {
      font-size: 20px;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 1mm;
      letter-spacing: 0.5px;
    }

    .company-details {
      font-size: 9px;
      color: #555;
      line-height: 1.8;
    }

    .invoice-title-section {
      text-align: right;
      flex: 1;
    }

    .invoice-label {
      font-size: 28px;
      font-weight: 700;
      color: #fa1313;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 2mm;
    }

    .invoice-meta {
      font-size: 9px;
      color: #555;
      line-height: 1.8;
    }

    .invoice-meta strong {
      color: #1a1a2e;
      font-weight: 600;
    }

    .gst-section {
      background: #f8fafc;
      border-left: 3px solid #fa1313;
      padding: 3mm 4mm;
      margin-bottom: 6mm;
      font-size: 9px;
      color: #555;
      line-height: 1.8;
      display: flex;
      justify-content: space-between;
    }

    .gst-section strong {
      color: #1a1a2e;
      font-weight: 600;
    }

    .bill-to-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6mm;
      gap: 10mm;
    }

    .bill-to {
      flex: 1;
      background: #f8fafc;
      padding: 4mm 5mm;
      border-radius: 3px;
      border: 1px solid #e5e7eb;
    }

    .section-label {
      font-size: 9px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 2mm;
    }

    .bill-to-name {
      font-size: 12px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 1mm;
    }

    .bill-to-details {
      font-size: 9px;
      color: #555;
      line-height: 1.8;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6mm;
    }

    .items-table thead {
      background: #fa1313;
      color: #ffffff;
    }

    .items-table th {
      padding: 3mm 3mm;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
    }

    .items-table th:last-child,
    .items-table th:nth-child(3) {
      text-align: right;
    }

    .items-table td {
      padding: 3mm 3mm;
      border-bottom: 1px solid #e5e7eb;
      font-size: 9.5px;
      color: #333;
    }

    .items-table td:last-child,
    .items-table td:nth-child(3) {
      text-align: right;
      font-weight: 500;
    }

    .items-table tbody tr:nth-child(even) {
      background: #f9fafb;
    }

    .item-description {
      font-size: 8.5px;
      color: #6b7280;
      margin-top: 0.5mm;
    }

    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 8mm;
    }

    .totals-table {
      width: 50%;
      border-collapse: collapse;
    }

    .totals-table td {
      padding: 1.5mm 3mm;
      font-size: 9px;
      color: #555;
    }

    .totals-table td:last-child {
      text-align: right;
      font-weight: 500;
      color: #333;
    }

    .totals-table .total-row {
      font-size: 11px;
      font-weight: 700;
      color: #1a1a2e;
      border-top: 2px solid #fa1313;
    }

    .totals-table .total-row td:last-child {
      color: #fa1313;
      font-size: 12px;
    }

    .payment-section {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 3px;
      padding: 4mm 5mm;
      margin-bottom: 6mm;
    }

    .payment-status {
      display: inline-block;
      background: #22c55e;
      color: #ffffff;
      padding: 1mm 3mm;
      border-radius: 2px;
      font-size: 8px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2mm;
    }

    .payment-details {
      font-size: 9px;
      color: #555;
      line-height: 1.8;
    }

    .payment-details strong {
      color: #1a1a2e;
      font-weight: 600;
    }

    .terms-section {
      margin-top: 6mm;
      padding-top: 3mm;
      border-top: 1px solid #e5e7eb;
      font-size: 7.5px;
      color: #9ca3af;
      line-height: 1.6;
    }

    .terms-title {
      font-weight: 600;
      color: #6b7280;
      margin-bottom: 1mm;
    }

    .invoice-footer {
      margin-top: 8mm;
      padding-top: 3mm;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 8px;
      color: #9ca3af;
    }

    .amount-words {
      font-size: 9px;
      color: #555;
      font-style: italic;
      margin-top: 2mm;
    }

    .amount-words strong {
      font-weight: 600;
      color: #1a1a2e;
      font-style: normal;
    }

    @media print {
      body { background: #fff; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    
    <div class="invoice-header">
      <div class="company-info">
        <div class="company-logo">${logoHtml}</div>
        <div class="company-name">${escapeHtml(COMPANY_DETAILS.name)}</div>
        <div class="company-details">
          ${escapeHtml(COMPANY_DETAILS.address)}<br>
          ${escapeHtml(COMPANY_DETAILS.city)}, ${escapeHtml(COMPANY_DETAILS.state)} - ${escapeHtml(COMPANY_DETAILS.pincode)}<br>
          Phone: ${escapeHtml(COMPANY_DETAILS.phone)}<br>
          Email: ${escapeHtml(COMPANY_DETAILS.email)}
        </div>
      </div>
      <div class="invoice-title-section">
        <div class="invoice-label">Invoice</div>
        <div class="invoice-meta">
          <strong>Invoice No:</strong> ${escapeHtml(invoiceId)}<br>
          <strong>Date:</strong> ${escapeHtml(invoiceDate)}<br>
          <strong>Agreement ID:</strong> ${escapeHtml(partner.agreement_id || 'N/A')}
        </div>
      </div>
    </div>

    <div class="gst-section">
      <div><strong>GSTIN:</strong> ${escapeHtml(COMPANY_DETAILS.gstin)}</div>
      <div><strong>Place of Supply:</strong> ${escapeHtml(placeOfSupply)}</div>
    </div>

    <div class="bill-to-section">
      <div class="bill-to">
        <div class="section-label">Bill To</div>
        <div class="bill-to-name">${escapeHtml(partner.name)}</div>
        <div class="bill-to-details">
          ${escapeHtml(partnerFullAddress)}<br>
          Phone: ${escapeHtml(partner.phone_number)}<br>
          Email: ${escapeHtml(partner.email)}
        </div>
      </div>
      <div class="bill-to">
        <div class="section-label">Service Partner Details</div>
        <div class="bill-to-details">
          <strong>Partner ID:</strong> ${escapeHtml(partner.id.toString())}<br>
          <strong>Working City:</strong> ${escapeHtml(partner.working_city)}<br>
          <strong>Status:</strong> Confirmed
        </div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 5%;">#</th>
          <th style="width: 45%;">Description</th>
          <th style="width: 15%;">Rate (₹)</th>
          <th style="width: 20%;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>
            <strong>Service Partner Registration & Welcome Kit</strong>
            <div class="item-description">
              Platform registration, background verification, I-Card, T-Shirt & documentation kit for independent service partnership with Homecarehelp platform.
            </div>
          </td>
          <td>${subtotal}</td>
          <td>${subtotal}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals-section">
      <table class="totals-table">
        <tr>
          <td>Subtotal</td>
          <td>₹ ${subtotal}</td>
        </tr>
        ${taxHtml}
        <tr class="total-row">
          <td>Total</td>
          <td>₹ ${total}</td>
        </tr>
      </table>
    </div>

    <div class="amount-words">
      <strong>Amount in Words:</strong> Two Thousand Nine Hundred and Fifty Rupees Only
    </div>

    <div class="terms-section">
      <div class="terms-title">Terms & Conditions:</div>
      • This is a computer-generated invoice and does not require a physical signature.<br>
      • The registration fee is non-refundable as per the Service Partner Agreement.<br>
      • This invoice serves as proof of payment for the Homecarehelp Service Partner Program.<br>
    </div>

    <div class="invoice-footer">
      © ${new Date().getFullYear()} ${escapeHtml(COMPANY_DETAILS.name)}. All Rights Reserved. | ${escapeHtml(COMPANY_DETAILS.website)}<br>
      This is an electronically generated invoice and is valid without signature.
    </div>

  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

module.exports = { generateInvoicePDF };