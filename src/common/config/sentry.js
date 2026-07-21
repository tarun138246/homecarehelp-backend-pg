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
      
      // Ignore certain errors
      ignoreErrors: [
        'Too many attempts',
        'ECONNREFUSED',
        'ENOTFOUND',
        'Rate limit exceeded',
      ],
      
      // Send default PII (Personally Identifiable Information)
      sendDefaultPii: false,
    });

    sentryInitialized = true;
    console.log('[Sentry] Initialized successfully');
    
    return true;
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error.message);
    return false;
  }
}

function captureException(error, context = {}) {
  if (!sentryInitialized) {
    console.error('[Sentry] Not initialized - error:', error.message);
    return null;
  }

  try {
    return Sentry.captureException(error, {
      extra: context
    });
  } catch (err) {
    console.error('[Sentry] Failed to capture exception:', err.message);
    return null;
  }
}

function captureMessage(message, level = 'info', context = {}) {
  if (!sentryInitialized) {
    return null;
  }

  try {
    return Sentry.captureMessage(message, {
      level,
      extra: context
    });
  } catch (err) {
    console.error('[Sentry] Failed to capture message:', err.message);
    return null;
  }
}

function setUser(user) {
  if (!sentryInitialized) {
    return;
  }

  try {
    Sentry.setUser(user);
  } catch (err) {
    console.error('[Sentry] Failed to set user:', err.message);
  }
}

function addBreadcrumb(breadcrumb) {
  if (!sentryInitialized) {
    return;
  }

  try {
    Sentry.addBreadcrumb(breadcrumb);
  } catch (err) {
    console.error('[Sentry] Failed to add breadcrumb:', err.message);
  }
}

module.exports = {
  Sentry, 
  initSentry,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
  get isInitialized() {
    return sentryInitialized;
  }
};