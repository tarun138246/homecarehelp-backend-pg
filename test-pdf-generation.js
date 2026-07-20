const { generateAgreementPDF } = require('./src/common/utils/agreementPdf');
const { generateInvoicePDF } = require('./src/common/utils/invoicePdf');
const fs = require('fs').promises;
const path = require('path');

// Mock partner data matching your DB schema
const mockPartner = {
  id: BigInt(123),
  name: 'Ramesh Kumar',
  email: 'ramesh.kumar@example.com',
  phone_number: '9876543210',
  working_city: 'Jhansi',
  pincode: '284003',
  address: JSON.stringify({
    street: 'House No. 45, Gandhi Nagar',
    landmark: 'Near Post Office',
    area: 'Sipri Bazar',
    city: 'Jhansi',
    state: 'Uttar Pradesh',
    pincode: '284003'
  }),
  selected_services: JSON.stringify(['plumbing', 'electrical']),
  agreement_id: 'HCH-123-a1b2c3d4-e5f6g7h8',
  payment_details: {
    order_id: 'order_ptn_123',
    order_amount: 2950,
    order_currency: 'INR',
    payment_id: 'cf_pay_987654',
    payment_status: 'SUCCESS',
    payment_time: '2025-01-15T12:20:29+05:30',
    payment_method: 'UPI',
    upi_id: 'ramesh@ybl',
    bank_reference: 'BANK123456',
    created_at: '2025-01-15T12:15:00+05:30',
    updated_at: '2025-01-15T12:20:29+05:30',
    status: 'SUCCESS'
  },
  status: 'confirmed',
  invoice_id: 'INV-HCH-123-ABC123-XYZ456'
};

// Sample signature (small base64 placeholder - replace with real signature for testing)
const mockSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function testAgreementPDF() {
  console.log('Testing Agreement PDF generation...');
  try {
    const pdfBuffer = await generateAgreementPDF(mockPartner, mockSignature);
    const outputPath = path.join(__dirname, '..', 'test-agreement.pdf');
    await fs.writeFile(outputPath, pdfBuffer);
    console.log(`✅ Agreement PDF generated successfully at: ${outputPath}`);
    console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('❌ Agreement PDF generation failed:', error.message);
  }
}

async function testInvoicePDF() {
  console.log('\nTesting Invoice PDF generation...');
  try {
    const pdfBuffer = await generateInvoicePDF(mockPartner, mockPartner.invoice_id);
    const outputPath = path.join(__dirname, '..', 'test-invoice.pdf');
    await fs.writeFile(outputPath, pdfBuffer);
    console.log(`✅ Invoice PDF generated successfully at: ${outputPath}`);
    console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('❌ Invoice PDF generation failed:', error.message);
  }
}

async function testBothPDFs() {
  console.log('=== PDF Generation Tests ===\n');
  console.log('Partner Data:', {
    name: mockPartner.name,
    email: mockPartner.email,
    phone: mockPartner.phone_number,
    city: mockPartner.working_city,
    pincode: mockPartner.pincode,
    agreementId: mockPartner.agreement_id,
    invoiceId: mockPartner.invoice_id,
    status: mockPartner.status
  });
  console.log('\n');

  await testAgreementPDF();
  await testInvoicePDF();
  
  console.log('\n=== Tests Complete ===');
}

// Run tests
testBothPDFs().catch(console.error);