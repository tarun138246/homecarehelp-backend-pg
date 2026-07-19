const puppeteer = require('puppeteer');
const path = require('path');
const env = require('../config/env');

async function generateAgreementPDF(partner, signatureBase64) {
  // Build absolute file:// URL for the logo image (no base64)
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
  // Convert to a file URL that Chromium can load
  const logoFileUrl = `file://${logoPath.replace(/\\/g, '/')}`;  // ensures forward slashes

  const html = buildAgreementHtml(partner, signatureBase64, logoFileUrl);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: env.puppeteerExecutablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

function buildAgreementHtml(partner, signatureBase64, logoFileUrl) {
  const primaryRed = '#B71C1C';
  const lightBg = '#FFF8F8';
  const textColor = '#222';

  // Logo element: uses the file:// URL if available, else a fallback placeholder
  const logoHtml = logoFileUrl
    ? `<img src="${logoFileUrl}" alt="Homecarehelp Logo" style="height: 40px; width: auto;">`
    : `<div style="background: ${primaryRed}; color: #fff; width: 40px; height: 40px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: bold;">🏠</div>`;

  return `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <title>Service Partner Agreement – Homecarehelp</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      color: ${textColor};
      background: #fff;
      font-size: 15px;
      line-height: 1.7;
    }
    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 15mm 18mm 20mm 18mm;
      background: #fff;
    }

    .doc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid ${primaryRed};
      padding-bottom: 10px;
      margin-bottom: 25px;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: ${primaryRed};
      letter-spacing: 0.5px;
    }
    .doc-title {
      font-size: 14px;
      font-weight: 600;
      color: ${primaryRed};
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .ref-no {
      font-size: 11px;
      color: #777;
      text-align: right;
    }

    .agreement-title {
      text-align: center;
      font-size: 22px;
      font-weight: bold;
      color: ${primaryRed};
      margin: 20px 0 30px;
      padding: 8px 0;
      border-top: 1px solid #ddd;
      border-bottom: 1px solid #ddd;
    }

    .term-block {
      margin-bottom: 28px;
      padding-left: 15px;
      border-left: 5px solid ${primaryRed};
      background: ${lightBg};
      padding: 12px 15px 12px 20px;
      border-radius: 2px;
    }
    .term-heading {
      font-size: 17px;
      font-weight: 700;
      color: ${primaryRed};
      margin-bottom: 8px;
    }
    .term-text-hindi {
      font-weight: 700;
      margin-bottom: 6px;
      color: #111;
    }
    .term-text-english {
      font-style: italic;
      color: #444;
    }

    .agreement-declaration {
      margin: 35px 0 25px;
      padding: 15px 20px;
      border: 1px solid ${primaryRed};
      background: ${lightBg};
      font-weight: 500;
      border-radius: 4px;
    }
    .agreement-declaration strong {
      color: ${primaryRed};
    }
    .agreement-declaration .hindi-text {
      font-weight: 700;
      margin-bottom: 6px;
    }
    .agreement-declaration .english-text {
      font-style: italic;
      color: #555;
    }

    .sign-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 40px;
      border-top: 2px solid #ccc;
      padding-top: 25px;
    }
    .sign-box {
      text-align: center;
      width: 220px;
    }
    .sign-box .label {
      font-weight: bold;
      font-size: 15px;
      color: #333;
      margin-bottom: 10px;
    }
    .sign-box img {
      width: 170px;
      height: auto;
      margin: 10px 0 5px;
      border-bottom: 1px solid #000;
      display: block;
      margin-left: auto;
      margin-right: auto;
    }
    .sign-box p {
      font-size: 14px;
      margin: 4px 0;
    }
    .sign-box .partner-name {
      font-weight: bold;
      font-size: 16px;
      color: #000;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .date {
      color: #555;
    }

    @media print {
      body { background: #fff; }
      .page { box-shadow: none; padding: 10mm 12mm; }
      .term-block { background: #fff; border-left: 4px solid ${primaryRed}; }
      .agreement-declaration { background: #fff; }
      .doc-header { border-bottom-width: 2px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="doc-header">
      <div class="logo-area">
        ${logoHtml}
        <div class="company-name">Homecarehelp</div>
      </div>
      <div>
        <div class="doc-title">Service Partner Agreement</div>
        <div class="ref-no">Ref: HCH/SP/2025-26</div>
      </div>
    </div>

    <div class="agreement-title">
      सर्विस पार्टनर नियम एवं शर्तें<br>
      <span style="font-size:18px; font-weight:normal;">Service Partner Terms &amp; Conditions</span>
    </div>

    <!-- Terms 1-6 (unchanged) -->
    <div class="term-block">
      <div class="term-heading">1. व्यावसायिक जुड़ाव एवं ऑनबोर्डिंग शुल्क (Commercial Association & Registration)</div>
      <div class="term-text-hindi">यह कि मैं Homecarehelp प्लेटफॉर्म के साथ एक स्वतंत्र सर्विस पार्टनर (Independent Technician) के रूप में जुड़ रहा हूँ। मैं कंपनी का कर्मचारी (Employee) नहीं हूँ। यह कि मैंने प्लेटफॉर्म पर पंजीकरण, बैकग्राउंड वेरिफिकेशन और वेलकम किट (I-Card, T-Shirt, दस्तावेज़) के लिए ₹2,950 (दो हजार नौ सौ पचास रुपये) का भुगतान किया है।</div>
      <div class="term-text-english">That I am joining the Homecarehelp platform as an Independent Service Partner (Independent Technician). I am not an employee of the company. That I have paid an amount of ₹2,950 (Two Thousand Nine Hundred and Fifty Rupees) for platform registration, background verification, and the welcome kit (I-Card, T-Shirt, documents).</div>
    </div>

    <div class="term-block">
      <div class="term-heading">2. गैर-वापसी योग्य नीति की पूर्ण स्वीकृति (Acknowledge of Non-Refundable Policy)</div>
      <div class="term-text-hindi">मैं पूरी तरह से समझता हूँ और स्वीकार करता हूँ कि यह ₹2,950 का शुल्क पूर्णतः गैर-वापसी योग्य (100% Non-Refundable) है। भविष्य में काम (Leads) की मात्रा कम होने, व्यक्तिगत कारणों से काम बंद करने या किसी भी अन्य परिस्थिति में, मैं इस राशि की वापसी (Refund) का दावा नहीं करूँगा।</div>
      <div class="term-text-english">I completely understand and accept that this fee of ₹2,950 is 100% non-refundable. In the future, due to low work volume (leads), cessation of work for personal reasons, or any other circumstances, I will not claim a refund of this amount.</div>
    </div>

    <div class="term-block">
      <div class="term-heading">3. काम/लीड्स की उपलब्धता और प्रतीक्षा अवधि (Work & Lead Allocation Disclaimer)</div>
      <div class="term-text-hindi">मैं यह स्वीकार करता हूँ कि Homecarehelp एक सर्विस एग्रीगेटर है जो बाजार की मांग और ग्राहकों की आवश्यकता के आधार पर काम आवंटित करता है। कंपनी मुझे तुरंत, नियमित या प्रतिदिन काम (Leads) देने की कोई गारंटी नहीं देती है। मेरे स्थानीय क्षेत्र (PIN Code) या शहर में ग्राहकों की मांग और मौसम (Seasonal demand) के अनुसार काम मिलने में 15 से 30 दिन या उससे अधिक का समय (Delay) लग सकता है, जिसके लिए मैं पूरी तरह से सहमत हूँ।</div>
      <div class="term-text-english">I acknowledge that Homecarehelp is a service aggregator that allocates work based on market demand and customer requirements. The company does not guarantee immediate, regular, or daily work (leads). Depending on customer demand and seasonal fluctuations in my local area (PIN Code) or city, it may take 15 to 30 days or more to receive work (delay), to which I fully agree.</div>
    </div>

    <div class="term-block">
      <div class="term-heading">4. कमीशन और भुगतान की शर्तें (Commission & Payout Terms)</div>
      <div class="term-text-hindi">मैं सहमत हूँ कि मेरे द्वारा सफलतापूर्वक पूरे किए गए प्रत्येक काम (Service) के कुल शुल्क का 70% हिस्सा मेरा (सर्विस पार्टनर का) होगा और 30% हिस्सा कंपनी (Homecarehelp) का होगा। मैं ग्राहकों से तयशुदा दर से अधिक पैसे नहीं वसूलूँगा और न ही कंपनी की जानकारी के बिना ग्राहकों से सीधा संबंध बनाऊँगा।</div>
      <div class="term-text-english">I agree that out of the total charges for each successfully completed job (service), a 70% share will belong to me (the Service Partner) and a 30% share will belong to the company (Homecarehelp). I will not overcharge customers beyond the fixed rates, nor will I establish direct relationships with customers without the company's knowledge.</div>
    </div>

    <div class="term-block">
      <div class="term-heading">5. भाषा एवं समझ का घोषणा पत्र (Language & Understanding Declaration)</div>
      <div class="term-text-hindi">मैं यह प्रमाणित करता हूँ कि मैंने इस शपथ पत्र और कंपनी के सभी नियमों व शर्तों को अपनी क्षेत्रीय/मातृभाषा (Regional Language) में गूगल ट्रांसलेट (Google Translate) या किसी अन्य माध्यम से अनुवाद करके पूरी तरह से पढ़ और समझ लिया है। भाषा की समझ न होने का बहाना बनाकर मैं भविष्य में किसी भी नियम से पीछे नहीं हटूँगा। पूरी संतुष्टि के बाद ही मैं इस पर हस्ताक्षर कर रहा हूँ।</div>
      <div class="term-text-english">I hereby certify that I have thoroughly read and understood this affidavit and all the terms and conditions of the company by translating them into my regional/native language using Google Translate or any other medium. I will not back down from any rule in the future using the excuse of a lack of language understanding. I am signing this only after complete satisfaction.</div>
    </div>

    <div class="term-block">
      <div class="term-heading">6. शिकायत निवारण एवं कानूनी क्षेत्राधिकार (Grievance & Legal Dispute Platform)</div>
      <div class="term-text-hindi">मैं यह घोषणा करता हूँ कि काम मिलने में देरी या काम न होने को मैं कभी भी "ऑनलाइन फ्रॉड", "धोखाधड़ी" या "साइबर अपराध" की श्रेणी में नहीं मानूँगा। इसलिए, मैं इस व्यापारिक विषय को लेकर बैंक, पेमेंट गेटवे या साइबर क्राइम पोर्टल (Cyber Cell) पर कोई झूठी शिकायत दर्ज नहीं करूँगा। यदि भविष्य में मेरा कंपनी के साथ सेवाओं या किसी भी बात को लेकर कोई विवाद होता है और मैं उसकी शिकायत या कानूनी कार्रवाई करना चाहता हूँ, तो मैं इसके लिए केवल उपभोक्ता फोरम (Consumer Forum) या संबंधित दीवानी न्यायालय (Civil Court) का ही दरवाजा खटखटाऊँगा। इस प्रकार के किसी भी कानूनी विवाद की स्थिति में, न्यायिक क्षेत्र केवल झांसी, उत्तर प्रदेश (Jhansi, UP) की अदालतें ही होंगी।</div>
      <div class="term-text-english">I hereby declare that I will never categorize a delay in receiving work or lack of work under "online fraud", "cheating", or "cybercrime". Therefore, I will not file any false complaints regarding this commercial matter with banks, payment gateways, or cyber crime portals (Cyber Cell). If any dispute arises in the future with the company regarding services or any matter and I wish to lodge a complaint or take legal action, I will only approach the Consumer Forum or the relevant Civil Court. In the event of any such legal dispute, the judicial jurisdiction shall strictly be the courts of Jhansi, Uttar Pradesh (Jhansi, UP).</div>
    </div>

    <!-- Agreement Declaration (text only, no checkbox) -->
    <div class="agreement-declaration">
      <div class="hindi-text"><strong>मैं सहमत हूँ:</strong> मैंने ऊपर दिए गए सभी 6 बिंदुओं (नियमों और शर्तों) को पढ़ और समझ लिया है और मैं बिना किसी दबाव के इन्हें पूरी तरह स्वीकार करता हूँ।</div>
      <div class="english-text"><strong>I Agree:</strong> I have read and understood all the 6 points (Terms & Conditions) mentioned above and I accept them fully without any pressure.</div>
    </div>

    <!-- Signature Section -->
    <div class="sign-section">
      <div class="sign-box">
        <div class="label">Partner Sign</div>
        <img src="${signatureBase64}" alt="Partner Signature">
        <p class="partner-name">${escapeHtml(partner.name)}</p>
        <p class="date">Date: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

module.exports = { generateAgreementPDF };