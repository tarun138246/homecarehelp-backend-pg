const Sentry = require('@sentry/node');
const env = require('./env');

let sentryInitialized = false;

function initSentry() {
  if (!env.sentryDsn) {
    console.log('[Sentry] DSN not configured - error tracking disabled');
    return false;
  }

  if (sentryInitialized) {
    return true;
  }

  try {
    Sentry.init({
      dsn: env.sentryDsn,
      environment: env.sentryEnvironment || env.nodeEnv || 'development',
      tracesSampleRate: env.sentryTracesSampleRate || 0.1,
      ignoreErrors: [
        'Too many attempts',
        'ECONNREFUSED',
        'ENOTFOUND',
        'Rate limit exceeded',
      ],
      sendDefaultPii: false,
    });

    sentryInitialized = true;
    console.log('[Sentry] Initialized successfully - v10');
    return true;
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error.message);
    return false;
  }
}

// In Sentry v8+, use setupExpressErrorHandler instead of Handlers
function setupExpress(app) {
  if (!sentryInitialized) return;

  try {
    // Sentry v10: setupExpressErrorHandler replaces the old Handlers pattern
    Sentry.setupExpressErrorHandler(app);
    console.log('[Sentry] Express error handler setup complete');
  } catch (err) {
    console.error('[Sentry] Failed to setup Express:', err.message);
  }
}

function captureException(error, context = {}) {
  if (!sentryInitialized) return null;
  try {
    return Sentry.captureException(error, { extra: context });
  } catch (err) {
    return null;
  }
}

function captureMessage(message, level = 'info', context = {}) {
  if (!sentryInitialized) return null;
  try {
    return Sentry.captureMessage(message, { level, extra: context });
  } catch (err) {
    return null;
  }
}

function setUser(user) {
  if (!sentryInitialized) return;
  try {
    Sentry.setUser(user);
  } catch (err) {}
}

function addBreadcrumb(breadcrumb) {
  if (!sentryInitialized) return;
  try {
    Sentry.addBreadcrumb(breadcrumb);
  } catch (err) {}
}

module.exports = {
  Sentry,
  initSentry,
  setupExpress,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
  get isInitialized() {
    return sentryInitialized;
  }
};