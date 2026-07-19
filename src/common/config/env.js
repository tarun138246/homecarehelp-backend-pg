const nodeEnv = process.env.NODE_ENV || 'development';

const required = ['DATABASE_URL', 'JWT_SECRET', 'CASHFREE_CLIENT_ID', 'CASHFREE_CLIENT_SECRET'];
const placeholders = {
  JWT_SECRET: 'your_jwt_secret',
  CASHFREE_CLIENT_ID: 'your_client_id',
  CASHFREE_CLIENT_SECRET: 'your_client_secret'
};

const missing = required.filter((key) => !process.env[key]);
const usingPlaceholder = Object.entries(placeholders).filter(
  ([key, value]) => process.env[key] === value
);

if (nodeEnv === 'production' && (missing.length || usingPlaceholder.length)) {
  const problems = [
    ...missing.map((k) => `${k} is not set`),
    ...usingPlaceholder.map(([k]) => `${k} is still set to its placeholder value`)
  ];
  throw new Error(`[env] Refusing to start in production with invalid config:\n  - ${problems.join('\n  - ')}`);
}

if (missing.length) {
  console.warn(`[env] Missing recommended env vars: ${missing.join(', ')}`);
}

const cashfreeEnv = (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase();
if (!['SANDBOX', 'PRODUCTION'].includes(cashfreeEnv)) {
  throw new Error(`[env] CASHFREE_ENV must be "SANDBOX" or "PRODUCTION", got "${cashfreeEnv}"`);
}

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  cashfreeClientId: process.env.CASHFREE_CLIENT_ID,
  cashfreeClientSecret: process.env.CASHFREE_CLIENT_SECRET,
  cashfreeEnv,
  cashfreeApiVersion: process.env.CASHFREE_API_VERSION || '2025-01-01',
  cashfreeReturnUrl: process.env.CASHFREE_RETURN_URL || 'https://homecarehelp.in/payment/return',

  agreementTempDir: process.env.AGREEMENT_TEMP_DIR || './tmp/agreements',
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,

  pratimaBaseUrl: process.env.PRATIMA_BASE_URL || 'https://pratima.homecarehelp.in',
  pratimaApiKey: process.env.PRATIMA_API_KEY,
  pratimaCompanyId: process.env.PRATIMA_COMPANY_ID,

  // Comma-separated list of allowed frontend origins for CORS, e.g.
  // "https://homecarehelp.in,https://partner.homecarehelp.in"
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),

  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
};
