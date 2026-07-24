const nodeEnv = process.env.NODE_ENV || 'development';

// Determine which Cashfree environment to use
const cashfreeEnv = (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase();
if (!['SANDBOX', 'PRODUCTION'].includes(cashfreeEnv)) {
  throw new Error(`[env] CASHFREE_ENV must be "SANDBOX" or "PRODUCTION", got "${cashfreeEnv}"`);
}

// Select the appropriate Cashfree keys based on environment
const cashfreeClientId = cashfreeEnv === 'PRODUCTION'
  ? process.env.PRODUCTION_CASHFREE_CLIENT_ID
  : process.env.SANDBOX_CASHFREE_CLIENT_ID;

const cashfreeClientSecret = cashfreeEnv === 'PRODUCTION'
  ? process.env.PRODUCTION_CASHFREE_CLIENT_SECRET
  : process.env.SANDBOX_CASHFREE_CLIENT_SECRET;

// Validate required environment variables
const required = ['DATABASE_URL', 'JWT_SECRET'];
const placeholders = {
  JWT_SECRET: 'your_jwt_secret'
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

// Validate Cashfree keys are set
if (!cashfreeClientId || cashfreeClientId === 'PRODUCTION_CLIENT_ID_HERE') {
  if (cashfreeEnv === 'PRODUCTION') {
    throw new Error('[env] PRODUCTION_CASHFREE_CLIENT_ID is not set or still has placeholder value');
  }
  console.warn('[env] SANDBOX_CASHFREE_CLIENT_ID is not set');
}

if (!cashfreeClientSecret || cashfreeClientSecret === 'PRODUCTION_CLIENT_SECRET_HERE') {
  if (cashfreeEnv === 'PRODUCTION') {
    throw new Error('[env] PRODUCTION_CASHFREE_CLIENT_SECRET is not set or still has placeholder value');
  }
  console.warn('[env] SANDBOX_CASHFREE_CLIENT_SECRET is not set');
}

// Log which environment is active
console.log(`[env] Cashfree Environment: ${cashfreeEnv}`);
console.log(`[env] Using Cashfree Client ID: ${cashfreeClientId ? cashfreeClientId.substring(0, 10) + '...' : 'NOT SET'}`);

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Cashfree configuration (auto-selected based on CASHFREE_ENV)
  cashfreeClientId,
  cashfreeClientSecret,
  cashfreeEnv,
  cashfreeApiVersion: process.env.CASHFREE_API_VERSION || '2025-01-01',
  cashfreeReturnUrl: process.env.CASHFREE_RETURN_URL || 'https://homecarehelp.in/payment/return',

  // Encryption keys for partner ID proofs
  ENCRYPTION_KEY_1: process.env.ENCRYPTION_KEY_1,
  ENCRYPTION_KEY_2: process.env.ENCRYPTION_KEY_2,

  agreementTempDir: process.env.AGREEMENT_TEMP_DIR || './tmp/agreements',
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,

  pratimaBaseUrl: process.env.PRATIMA_BASE_URL || 'https://pratima.homecarehelp.in',
  pratimaApiKey: process.env.PRATIMA_API_KEY,
  pratimaCompanyId: process.env.PRATIMA_COMPANY_ID,

  corsOrigins: [
    'https://www.homecarehelp.in',
    'https://homecarehelp.in',
    'https://backend.homecarehelp.in',
    'http://localhost:3000',
    'http://localhost:3001'
  ],

  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,

  // Sentry error tracking
  sentryDsn: process.env.SENTRY_DSN || null,
  sentryEnvironment: process.env.SENTRY_ENVIRONMENT || nodeEnv,
  sentryTracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1')
};