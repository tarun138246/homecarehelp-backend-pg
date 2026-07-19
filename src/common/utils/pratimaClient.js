const env = require('../config/env');

// Client for the Pratima custom file-storage engine. Node 20's built-in
// fetch/FormData/Blob are used directly — no extra HTTP/multipart deps needed.

async function uploadFile(buffer, filename, mimeType) {
  if (!env.pratimaApiKey || !env.pratimaCompanyId) {
    throw Object.assign(new Error('Pratima engine is not configured (PRATIMA_API_KEY / PRATIMA_COMPANY_ID)'), { status: 500 });
  }

  const form = new FormData();
  form.append('company_id', env.pratimaCompanyId);
  form.append('image', new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch(`${env.pratimaBaseUrl}/upload`, {
    method: 'POST',
    headers: { 'x-api-key': env.pratimaApiKey },
    body: form
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw Object.assign(new Error(`Pratima upload failed (${res.status}): ${body}`), { status: 502 });
  }

  // { url, imageId, companyId, type }
  return res.json();
}

module.exports = { uploadFile };
