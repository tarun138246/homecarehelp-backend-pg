const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');

// Build the path to logo.png (project-root/assets/logo.png) and convert to base64 data URI
const logoPath = path.join(__dirname, '..', '..', '..', 'assets', 'logo.png');
let LOGO_BASE64 = '';

// Read the logo file and convert to base64 data URI
try {
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    const ext = path.extname(logoPath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    LOGO_BASE64 = `data:${mimeType};base64,${logoBuffer.toString('base64')}`;
  }
} catch (err) {
  console.warn('Logo file not found, using fallback:', err.message);
}

async function generateAgreementPDF(partner, signatureBase64) {
  const now = new Date();
  const agreementDate = now.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const agreementTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const html = buildAgreementHtml(partner, signatureBase64, LOGO_BASE64, agreementDate, agreementTime);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: env.puppeteerExecutablePath || null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--font-render-hinting=none']
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport for better rendering
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '6mm', right: '6mm' },
      preferCSSPageSize: true
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

function buildAgreementHtml(partner, signatureBase64, logoBase64, agreementDate, agreementTime) {
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="Homecarehelp Logo" style="height: 42px; width: auto;">`
    : `<div class="fallback-logo">H</div>`;

  const agreementId = partner.agreement_id || '';

  const hiddenMarker = agreementId
    ? `<span class="agid-marker" aria-hidden="true">AGID:${escapeHtml(agreementId)}</span>`
    : '';

  return `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <title>Service Partner Agreement – Homecarehelp</title>
  <style>
    /* Load Hindi font directly */
    @font-face {
      font-family: 'Noto Sans Devanagari';
      src: url('https://fonts.gstatic.com/s/notosansdevanagari/v24/TuGoTUfzXI5FBtUq5a8bjKYT7Hm4K4a5.ttf') format('truetype');
      font-weight: 400;
      font-style: normal;
      font-display: block;
    }
    
    @font-face {
      font-family: 'Noto Sans Devanagari';
      src: url('https://fonts.gstatic.com/s/notosansdevanagari/v24/TuGOUfzXI5FBtUq5a8bjKYT7Hm4K4a5.ttf') format('truetype');
      font-weight: 500;
      font-style: normal;
      font-display: block;
    }
    
    @font-face {
      font-family: 'Noto Sans Devanagari';
      src: url('https://fonts.gstatic.com/s/notosansdevanagari/v24/TuGOUfzXI5FBtUq5a8bjKYT7Hm4K4a5.ttf') format('truetype');
      font-weight: 700;
      font-style: normal;
      font-display: block;
    }

    @font-face {
      font-family: 'Inter';
      src: url('https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5n-wU.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: block;
    }

    @font-face {
      font-family: 'Inter';
      src: url('https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5n-wU.woff2') format('woff2');
      font-weight: 600;
      font-style: normal;
      font-display: block;
    }

    @font-face {
      font-family: 'Inter';
      src: url('https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5n-wU.woff2') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: block;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Noto Sans', sans-serif;
      color: #1a1a1a;
      background: #ffffff;
      font-size: 10.5pt;
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .hindi-font {
      font-family: 'Noto Sans Devanagari', 'Arial Unicode MS', 'Mangal', 'Lohit Devanagari', sans-serif;
    }

    .page {
      width: 100%;
      background: #ffffff;
      position: relative;
    }

    /* ===== COVER PAGE ===== */
    .cover-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 257mm;
      text-align: center;
      padding: 25mm 20mm;
    }

    .cover-logo {
      margin-bottom: 5mm;
    }
    .cover-logo img {
      height: 42px;
      width: auto;
      image-rendering: auto;
    }
    .cover-logo .fallback-logo {
      width: 34mm;
      height: 34mm;
      background: #1a1a1a;
      color: #ffffff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 38px;
      font-weight: 700;
      letter-spacing: -1px;
      margin: 0 auto;
    }

    .cover-company-name {
      font-size: 26px;
      font-weight: 700;
      color: #1a1a1a;
      letter-spacing: 0.5px;
      margin-bottom: 3mm;
    }

    .cover-agreement-line {
      font-size: 12px;
      font-weight: 400;
      color: #555;
      margin-bottom: 12mm;
      letter-spacing: 0.3px;
      max-width: 140mm;
      line-height: 1.7;
    }
    .cover-agreement-line strong {
      font-weight: 600;
      color: #1a1a1a;
    }

    .cover-divider {
      width: 60mm;
      height: 1px;
      background: #ccc;
      margin: 0 auto 10mm auto;
    }

    .cover-details {
      text-align: center;
      font-size: 11px;
      color: #444;
      line-height: 2.4;
    }
    .cover-details .detail-row {
      margin-bottom: 2px;
    }
    .cover-details strong {
      font-weight: 600;
      color: #1a1a1a;
      display: inline-block;
      min-width: 110px;
      text-align: right;
      margin-right: 8px;
    }
    .cover-details span {
      font-weight: 400;
      color: #555;
    }

    /* ===== TERMS PAGE ===== */
    .terms-wrapper {
      padding: 14mm 16mm 8mm 16mm;
    }

    .terms-page-title {
      font-size: 17px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 7mm;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 3mm;
      margin-top: 20px;
    }

    .term-section {
      margin-bottom: 8mm;
    }

    .term-section-title {
      font-family: 'Noto Sans Devanagari', 'Arial Unicode MS', 'Mangal', 'Lohit Devanagari', sans-serif;
      font-size: 11.5px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 2.5mm;
      letter-spacing: 0.3px;
    }

    .term-section .hindi-text {
      font-family: 'Noto Sans Devanagari', 'Arial Unicode MS', 'Mangal', 'Lohit Devanagari', sans-serif;
      font-size: 10.5px;
      font-weight: 400;
      color: #2a2a2a;
      line-height: 1.9;
      margin-bottom: 2.5mm;
    }

    .term-section .english-text {
      font-family: 'Inter', 'Noto Sans', sans-serif;
      font-size: 10px;
      font-weight: 400;
      color: #555;
      line-height: 1.8;
      font-style: normal;
    }

    .term-separator {
      border: none;
      border-top: 0.5px solid #e5e5e5;
      margin: 5mm 0;
    }

    /* ===== SIGNATURE PAGE ===== */
    .signature-wrapper {
      padding: 18mm 20mm 10mm 20mm;
      display: flex;
      flex-direction: column;
      min-height: 257mm;
    }

    .agreement-statement {
      font-size: 12px;
      font-weight: 500;
      color: #1a1a1a;
      margin-bottom: 14mm;
      line-height: 1.9;
      border: 1px solid #e0e0e0;
      padding: 8mm 10mm;
      background: #fafafa;
      border-radius: 2px;
    }

    .agreement-statement .hindi-line {
      font-family: 'Noto Sans Devanagari', 'Arial Unicode MS', 'Mangal', sans-serif;
      margin-bottom: 3mm;
    }
    .agreement-statement .english-line {
      color: #555;
    }
    .agreement-statement strong {
      color: #1a1a1a;
    }

    .signature-block {
      margin-top: 8mm;
    }

    .signature-label {
      font-size: 10.5px;
      font-weight: 600;
      color: #1a1a1a;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5mm;
    }

    .signature-image-area {
      width: 200px;
      height: 60px;
      border-bottom: 1px solid #1a1a1a;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 3mm;
      margin-bottom: 4mm;
    }
    .signature-image-area img {
      max-width: 190px;
      max-height: 55px;
      object-fit: contain;
      image-rendering: auto;
    }

    .signatory-name {
      font-size: 13px;
      font-weight: 700;
      color: #1a1a1a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .signatory-info {
      font-size: 9.5px;
      color: #666;
      margin-top: 2.5mm;
      line-height: 1.9;
    }

    .electronic-note {
      margin-top: 40px;
      padding-top: 8mm;
      font-size: 8.5px;
      color: #888;
      text-align: center;
      letter-spacing: 0.3px;
      border-top: 0.5px solid #e5e5e5;
    }

    @media print {
      body { background: #fff; }
      .page { box-shadow: none; }
    }

    .agid-marker {
      position: absolute;
      top: 2mm;
      left: 2mm;
      font-size: 5px;
      color: #fffffe;
      pointer-events: none;
    }
  </style>
</head>
<body>

  <!-- ===================== COVER PAGE ===================== -->
  <div class="page">
    ${hiddenMarker}
    <div class="cover-wrapper">
      <div class="cover-logo">
        ${logoHtml}
      </div>
      <div class="cover-company-name">Homecarehelp</div>
      <div class="cover-agreement-line">
        Service Partner Agreement between Homecarehelp and<br>
        <strong>${escapeHtml(partner.name)}</strong> (Independent Service Partner)
      </div>
      <div class="cover-divider"></div>
      <div class="cover-details">
        <div class="detail-row"><strong>Partner Name:</strong> <span>${escapeHtml(partner.name)}</span></div>
        <div class="detail-row"><strong>Mobile:</strong> <span>${escapeHtml(partner.phone_number)}</span></div>
        <div class="detail-row"><strong>Date Accepted:</strong> <span>${agreementDate}</span></div>
        <div class="detail-row"><strong>Time Accepted:</strong> <span>${agreementTime}</span></div>
        <div class="detail-row"><strong>Agreement ID:</strong> <span>${escapeHtml(agreementId)}</span></div>
      </div>
    </div>
  </div>

  <!-- ===================== TERMS PAGE ===================== -->
  <div class="page">
    ${hiddenMarker}
    <div class="terms-wrapper">
      <div class="terms-page-title">Terms &amp; Conditions</div>

      <!-- Clause 1 -->
      <div class="term-section">
        <div class="term-section-title">1. व्यावसायिक जुड़ाव एवं ऑनबोर्डिंग शुल्क (Commercial Association &amp; Registration Fee)</div>
        <div class="hindi-text">यह कि मैं Homecarehelp प्लेटफॉर्म के साथ एक स्वतंत्र सर्विस पार्टनर (Independent Technician) के रूप में जुड़ रहा हूँ। मैं कंपनी का कर्मचारी (Employee) नहीं हूँ। यह कि मैंने प्लेटफॉर्म पर पंजीकरण, बैकग्राउंड वेरिफिकेशन और वेलकम किट (I-Card, T-Shirt, दस्तावेज़) के लिए ₹2,950 (दो हजार नौ सौ पचास रुपये) का भुगतान किया है।</div>
        <div class="english-text">I am joining the Homecarehelp platform as an Independent Service Partner (Independent Technician). I am not an employee of the company. I have paid an amount of ₹2,950 (Two Thousand Nine Hundred and Fifty Rupees) for platform registration, background verification, and the welcome kit (I-Card, T-Shirt, documents).</div>
      </div>
      <hr class="term-separator">

      <!-- Clause 2 -->
      <div class="term-section">
        <div class="term-section-title">2. गैर-वापसी योग्य नीति की पूर्ण स्वीकृति (Acknowledgement of Non-Refundable Policy)</div>
        <div class="hindi-text">मैं पूरी तरह से समझता हूँ और स्वीकार करता हूँ कि यह ₹2,950 का शुल्क पूर्णतः गैर-वापसी योग्य (100% Non-Refundable) है। भविष्य में काम (Leads) की मात्रा कम होने, व्यक्तिगत कारणों से काम बंद करने या किसी भी अन्य परिस्थिति में, मैं इस राशि की वापसी (Refund) का दावा नहीं करूँगा।</div>
        <div class="english-text">I completely understand and accept that this fee of ₹2,950 is 100% non-refundable. In the future, due to low work volume (leads), cessation of work for personal reasons, or any other circumstances, I will not claim a refund of this amount.</div>
      </div>
      <hr class="term-separator">

      <!-- Clause 3 -->
      <div class="term-section">
        <div class="term-section-title">3. काम/लीड्स की उपलब्धता और प्रतीक्षा अवधि (Work &amp; Lead Allocation Disclaimer)</div>
        <div class="hindi-text">मैं यह स्वीकार करता हूँ कि Homecarehelp एक सर्विस एग्रीगेटर है जो बाजार की मांग और ग्राहकों की आवश्यकता के आधार पर काम आवंटित करता है। कंपनी मुझे तुरंत, नियमित या प्रतिदिन काम (Leads) देने की कोई गारंटी नहीं देती है। मेरे स्थानीय क्षेत्र (PIN Code) या शहर में ग्राहकों की मांग और मौसम (Seasonal demand) के अनुसार काम मिलने में 15 से 30 दिन या उससे अधिक का समय (Delay) लग सकता है, जिसके लिए मैं पूरी तरह से सहमत हूँ।</div>
        <div class="english-text">I acknowledge that Homecarehelp is a service aggregator that allocates work based on market demand and customer requirements. The company does not guarantee immediate, regular, or daily work (leads). Depending on customer demand and seasonal fluctuations in my local area (PIN Code) or city, it may take 15 to 30 days or more to receive work (delay), to which I fully agree.</div>
      </div>
      <hr class="term-separator">

      <!-- Clause 4 -->
      <div class="term-section">
        <div class="term-section-title">4. कमीशन और भुगतान की शर्तें (Commission &amp; Payout Terms)</div>
        <div class="hindi-text">मैं सहमत हूँ कि मेरे द्वारा सफलतापूर्वक पूरे किए गए प्रत्येक काम (Service) के कुल शुल्क का 70% हिस्सा मेरा (सर्विस पार्टनर का) होगा और 30% हिस्सा कंपनी (Homecarehelp) का होगा। मैं ग्राहकों से तयशुदा दर से अधिक पैसे नहीं वसूलूँगा और न ही कंपनी की जानकारी के बिना ग्राहकों से सीधा संबंध बनाऊँगा।</div>
        <div class="english-text">I agree that out of the total charges for each successfully completed job (service), a 70% share will belong to me (the Service Partner) and a 30% share will belong to the company (Homecarehelp). I will not overcharge customers beyond the fixed rates, nor will I establish direct relationships with customers without the company's knowledge.</div>
      </div>
      <hr class="term-separator">

      <!-- Clause 5 -->
      <div class="term-section">
        <div class="term-section-title">5. भाषा एवं समझ का घोषणा पत्र (Language &amp; Understanding Declaration)</div>
        <div class="hindi-text">मैं यह प्रमाणित करता हूँ कि मैंने इस शपथ पत्र और कंपनी के सभी नियमों व शर्तों को अपनी क्षेत्रीय/मातृभाषा (Regional Language) में गूगल ट्रांसलेट (Google Translate) या किसी अन्य माध्यम से अनुवाद करके पूरी तरह से पढ़ और समझ लिया है। भाषा की समझ न होने का बहाना बनाकर मैं भविष्य में किसी भी नियम से पीछे नहीं हटूँगा। पूरी संतुष्टि के बाद ही मैं इस पर हस्ताक्षर कर रहा हूँ।</div>
        <div class="english-text">I hereby certify that I have thoroughly read and understood this affidavit and all the terms and conditions of the company by translating them into my regional/native language using Google Translate or any other medium. I will not back down from any rule in the future using the excuse of a lack of language understanding. I am signing this only after complete satisfaction.</div>
      </div>
      <hr class="term-separator">

      <!-- Clause 6 -->
      <div class="term-section">
        <div class="term-section-title">6. शिकायत निवारण एवं कानूनी क्षेत्राधिकार (Grievance &amp; Legal Dispute Resolution)</div>
        <div class="hindi-text">मैं यह घोषणा करता हूँ कि काम मिलने में देरी या काम न होने को मैं कभी भी "ऑनलाइन फ्रॉड", "धोखाधड़ी" या "साइबर अपराध" की श्रेणी में नहीं मानूँगा। इसलिए, मैं इस व्यापारिक विषय को लेकर बैंक, पेमेंट गेटवे या साइबर क्राइम पोर्टल (Cyber Cell) पर कोई झूठी शिकायत दर्ज नहीं करूँगा। यदि भविष्य में मेरा कंपनी के साथ सेवाओं या किसी भी बात को लेकर कोई विवाद होता है और मैं उसकी शिकायत या कानूनी कार्रवाई करना चाहता हूँ, तो मैं इसके लिए केवल उपभोक्ता फोरम (Consumer Forum) या संबंधित दीवानी न्यायालय (Civil Court) का ही दरवाजा खटखटाऊँगा। इस प्रकार के किसी भी कानूनी विवाद की स्थिति में, न्यायिक क्षेत्र केवल झांसी, उत्तर प्रदेश (Jhansi, UP) की अदालतें ही होंगी।</div>
        <div class="english-text">I hereby declare that I will never categorize a delay in receiving work or lack of work under "online fraud", "cheating", or "cybercrime". Therefore, I will not file any false complaints regarding this commercial matter with banks, payment gateways, or cyber crime portals (Cyber Cell). If any dispute arises in the future with the company regarding services or any matter and I wish to lodge a complaint or take legal action, I will only approach the Consumer Forum or the relevant Civil Court. In the event of any such legal dispute, the judicial jurisdiction shall strictly be the courts of Jhansi, Uttar Pradesh (Jhansi, UP).</div>
      </div>
    </div>
  </div>

  <!-- ===================== SIGNATURE PAGE ===================== -->
  <div class="page">
    ${hiddenMarker}
    <div class="signature-wrapper">
      <div class="agreement-statement">
        <div class="hindi-line"><strong>मैं सहमत हूँ:</strong> मैंने ऊपर दिए गए सभी 6 बिंदुओं (नियमों और शर्तों) को पढ़ और समझ लिया है और मैं बिना किसी दबाव के इन्हें पूरी तरह स्वीकार करता हूँ।</div>
        <div class="english-line"><strong>I Agree:</strong> I have read and understood all the 6 clauses (Terms &amp; Conditions) mentioned above and I accept them fully without any pressure.</div>
      </div>

      <div class="signature-block">
        <div class="signature-label">Service Partner Signature</div>
        <div class="signature-image-area">
          <img src="${signatureBase64}" alt="Partner Signature">
        </div>
        <div class="signatory-name">${escapeHtml(partner.name)}</div>
        <div class="signatory-info">
          Date: ${agreementDate}<br>
          Place: ${escapeHtml(partner.working_city)}<br>
          Mobile: ${escapeHtml(partner.phone_number)}<br>
          Agreement ID: ${escapeHtml(agreementId)}
        </div>
      </div>

      <div class="electronic-note">
        This agreement is electronically generated by Homecarehelp and does not require a physical signature of the company.
      </div>
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

module.exports = { generateAgreementPDF };