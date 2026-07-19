const puppeteer = require('puppeteer');
const env = require('../config/env');

async function generateAgreementPDF(partner, signatureBase64) {
  const html = buildAgreementHtml(partner, signatureBase64);
  const browser = await puppeteer.launch({
    headless: 'new',
    // On most Linux VPS deployments it's more reliable to point at a
    // system-installed Chromium (apt install chromium) via
    // PUPPETEER_EXECUTABLE_PATH than to ship Puppeteer's bundled download.
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

function buildAgreementHtml(partner, signatureBase64) {
  return `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <title>Partner Agreement - Homecarehelp</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.8; color: #000; }
    .header { display: flex; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
    .logo { font-size: 24px; font-weight: bold; flex: 1; text-align: left; }
    .title { font-size: 26px; font-weight: bold; flex: 2; text-align: center; }
    .spacer { flex: 1; }
    .terms { margin-top: 30px; }
    .terms p { margin-bottom: 15px; }
    .sign-section { display: flex; justify-content: flex-end; margin-top: 60px; border-top: 1px solid #ccc; padding-top: 20px; }
    .sign-box { text-align: center; width: 220px; }
    .sign-box .label { font-weight: bold; margin-bottom: 5px; }
    .sign-box img { width: 160px; height: auto; margin-top: 10px; border-bottom: 1px solid #000; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🏠 Logo</div>
    <div class="title">Homecarehelp</div>
    <div class="spacer"></div>
  </div>
  <h2 style="text-align:center;">सर्विस पार्टनर नियम एवं शर्तें (Service Partner Terms &amp; Conditions)</h2>
  <div class="terms">
    <p><strong>1. व्यावसायिक जुड़ाव एवं ऑनबोर्डिंग शुल्क (Commercial Association &amp; Registration)</strong><br>
    <span>यह कि मैं Homecarehelp प्लेटफॉर्म के साथ एक स्वतंत्र सर्विस पार्टनर (Independent Technician) के रूप में जुड़ रहा हूँ। मैं कंपनी का कर्मचारी (Employee) नहीं हूँ। यह कि मैंने प्लेटफॉर्म पर पंजीकरण, बैकग्राउंड वेरिफिकेशन और वेलकम किट (I-Card, T-Shirt, दस्तावेज़) के लिए ₹2,950 (दो हजार नौ सौ पचास रुपये) का भुगतान किया है।</span><br>
    That I am joining the Homecarehelp platform as an Independent Service Partner (Independent Technician). I am not an employee of the company. That I have paid an amount of ₹2,950 (Two Thousand Nine Hundred and Fifty Rupees) for platform registration, background verification, and the welcome kit (I-Card, T-Shirt, documents).</p>
    <p><strong>2. गैर-वापसी योग्य नीति की पूर्ण स्वीकृति (Acknowledge of Non-Refundable Policy)</strong><br>
    <span>मैं पूरी तरह से समझता हूँ और स्वीकार करता हूँ कि यह ₹2,950 का शुल्क पूर्णतः गैर-वापसी योग्य (100% Non-Refundable) है। भविष्य में काम (Leads) की मात्रा कम होने, व्यक्तिगत कारणों से काम बंद करने या किसी भी अन्य परिस्थिति में, मैं इस राशि की वापसी (Refund) का दावा नहीं करूँगा।</span><br>
    I completely understand and accept that this fee of ₹2,950 is 100% non-refundable. In the future, due to low work volume (leads), cessation of work for personal reasons, or any other circumstances, I will not claim a refund of this amount.</p>
    <p><strong>3. काम/लीड्स की उपलब्धता और प्रतीक्षा अवधि (Work &amp; Lead Allocation Disclaimer)</strong><br>
    <span>मैं यह स्वीकार करता हूँ कि Homecarehelp एक सर्विस एग्रीगेटर है जो बाजार की मांग और ग्राहकों की आवश्यकता के आधार पर काम आवंटित करता है। कंपनी मुझे तुरंत, नियमित या प्रतिदिन काम (Leads) देने की कोई गारंटी नहीं देती है। मेरे स्थानीय क्षेत्र (PIN Code) या शहर में ग्राहकों की मांग और मौसम (Seasonal demand) के अनुसार काम मिलने में 15 से 30 दिन या उससे अधिक का समय (Delay) लग सकता है, जिसके लिए मैं पूरी तरह से सहमत हूँ।</span><br>
    I acknowledge that Homecarehelp is a service aggregator that allocates work based on market demand and customer requirements. The company does not guarantee immediate, regular, or daily work (leads). Depending on customer demand and seasonal fluctuations in my local area (PIN Code) or city, it may take 15 to 30 days or more to receive work (delay), to which I fully agree.</p>
    <p><strong>4. कमीशन और भुगतान की शर्तें (Commission &amp; Payout Terms)</strong><br>
    <span>मैं सहमत हूँ कि मेरे द्वारा सफलतापूर्वक पूरे किए गए प्रत्येक काम (Service) के कुल शुल्क का 70% हिस्सा मेरा (सर्विस पार्टनर का) होगा और 30% हिस्सा कंपनी (Homecarehelp) का होगा। मैं ग्राहकों से तयशुदा दर से अधिक पैसे नहीं वसूलूँगा और न ही कंपनी की जानकारी के बिना ग्राहकों से सीधा संबंध बनाऊँगा।</span><br>
    I agree that out of the total charges for each successfully completed job (service), a 70% share will belong to me (the Service Partner) and a 30% share will belong to the company (Homecarehelp). I will not overcharge customers beyond the fixed rates, nor will I establish direct relationships with customers without the company's knowledge.</p>
    <p><strong>5. भाषा एवं समझ का घोषणा पत्र (Language &amp; Understanding Declaration)</strong><br>
    <span>मैं यह प्रमाणित करता हूँ कि मैंने इस शपथ पत्र और कंपनी के सभी नियमों व शर्तों को अपनी क्षेत्रीय/मातृभाषा (Regional Language) में गूगल ट्रांसलेट (Google Translate) या किसी अन्य माध्यम से अनुवाद करके पूरी तरह से पढ़ और समझ लिया है। भाषा की समझ न होने का बहाना बनाकर मैं भविष्य में किसी भी नियम से पीछे नहीं हटूँगा। पूरी संतुष्टि के बाद ही मैं इस पर हस्ताक्षर कर रहा हूँ।</span><br>
    I hereby certify that I have thoroughly read and understood this affidavit and all the terms and conditions of the company by translating them into my regional/native language using Google Translate or any other medium. I will not back down from any rule in the future using the excuse of a lack of language understanding. I am signing this only after complete satisfaction.</p>
    <p><strong>6. शिकायत निवारण एवं कानूनी क्षेत्राधिकार (Grievance &amp; Legal Dispute Platform)</strong><br>
    <span>मैं यह घोषणा करता हूँ कि काम मिलने में देरी या काम न होने को मैं कभी भी "ऑनलाइन फ्रॉड", "धोखाधड़ी" या "साइबर अपराध" की श्रेणी में नहीं मानूँगा। इसलिए, मैं इस व्यापारिक विषय को लेकर बैंक, पेमेंट गेटवे या साइबर क्राइम पोर्टल (Cyber Cell) पर कोई झूठी शिकायत दर्ज नहीं करूँगा। यदि भविष्य में मेरा कंपनी के साथ सेवाओं या किसी भी बात को लेकर कोई विवाद होता है और मैं उसकी शिकायत या कानूनी कार्रवाई करना चाहता हूँ, तो मैं इसके लिए केवल उपभोक्ता फोरम (Consumer Forum) या संबंधित दीवानी न्यायालय (Civil Court) का ही दरवाजा खटखटाऊँगा। इस प्रकार के किसी भी कानूनी विवाद की स्थिति में, न्यायिक क्षेत्र केवल झांसी, उत्तर प्रदेश (Jhansi, UP) की अदालतें ही होंगी।</span><br>
    I hereby declare that I will never categorize a delay in receiving work or lack of work under "online fraud", "cheating", or "cybercrime". Therefore, I will not file any false complaints regarding this commercial matter with banks, payment gateways, or cyber crime portals (Cyber Cell). If any dispute arises in the future with the company regarding services or any matter and I wish to lodge a complaint or take legal action, I will only approach the Consumer Forum or the relevant Civil Court. In the event of any such legal dispute, the judicial jurisdiction shall strictly be the courts of Jhansi, Uttar Pradesh (Jhansi, UP).</p>
  </div>
  <div class="sign-section">
    <div class="sign-box">
      <div class="label">Partner Sign</div>
      <img src="${signatureBase64}" alt="Signature">
      <p>${escapeHtml(partner.name)}</p>
      <p>Date: ${new Date().toLocaleDateString('en-IN')}</p>
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
