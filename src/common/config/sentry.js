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
      environment: env.sentryEnvironment,
      tracesSampleRate: env.sentryTracesSampleRate,
      
      // Integrations
      integrations: [
        // HTTP integration for tracking HTTP requests
        new Sentry.Integrations.Http({ tracing: true }),
        // Express integration
        new Sentry.Integrations.Express({ app: true }),
        // Console integration to capture console.log, console.error, etc.
        new Sentry.Integrations.Console({
          levels: ['log', 'info', 'warn', 'error', 'debug']
        }),
      ],

      // Capture all console output
      beforeBreadcrumb(breadcrumb, hint) {
        // Capture console logs as breadcrumbs
        if (breadcrumb.category === 'console') {
          return breadcrumb;
        }
        return breadcrumb;
      },

      // beforeSend hook to filter sensitive data
      beforeSend(event, hint) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['x-api-key'];
        }

        // Remove sensitive body data
        if (event.request?.data) {
          const data = event.request.data;
          if (typeof data === 'object') {
            // Redact password fields
            if (data.password) data.password = '[REDACTED]';
            if (data.oldPassword) data.oldPassword = '[REDACTED]';
            if (data.newPassword) data.newPassword = '[REDACTED]';
            // Redact credit card info
            if (data.cardNumber) data.cardNumber = '[REDACTED]';
            if (data.cvv) data.cvv = '[REDACTED]';
          }
        }

        return event;
      },

      // Ignore certain errors
      ignoreErrors: [
        'Too many attempts',
        'ECONNREFUSED',
        'ENOTFOUND',
      ],
      
      // Attach stack traces to all messages
      attachStacktrace: true,
      
      // Maximum number of breadcrumbs
      maxBreadcrumbs: 100,
      
      // Send default PII (Personally Identifiable Information)
      sendDefaultPii: false,
    });

    // Override console methods to send logs to Sentry
    const originalConsoleLog = console.log;
    const originalConsoleInfo = console.info;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;
    const originalConsoleDebug = console.debug;

    console.log = function(...args) {
      originalConsoleLog.apply(console, args);
      Sentry.addBreadcrumb({
        category: 'console',
        message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '),
        level: 'info',
      });
    };

    console.info = function(...args) {
      originalConsoleInfo.apply(console, args);
      Sentry.addBreadcrumb({
        category: 'console',
        message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '),
        level: 'info',
      });
    };

    console.warn = function(...args) {
      originalConsoleWarn.apply(console, args);
      Sentry.addBreadcrumb({
        category: 'console',
        message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '),
        level: 'warning',
      });
    };

    console.error = function(...args) {
      originalConsoleError.apply(console, args);
      
      // Send errors to Sentry
      const errorMessage = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      
      Sentry.addBreadcrumb({
        category: 'console',
        message: errorMessage,
        level: 'error',
      });
      
      // Also capture as an event if it looks like an error
      if (args[0] instanceof Error) {
        Sentry.captureException(args[0]);
      } else {
        Sentry.captureMessage(errorMessage, 'error');
      }
    };

    console.debug = function(...args) {
      originalConsoleDebug.apply(console, args);
      Sentry.addBreadcrumb({
        category: 'console',
        message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '),
        level: 'debug',
      });
    };

    sentryInitialized = true;
    console.log('[Sentry] Initialized successfully:', {
      environment: env.sentryEnvironment,
      tracesSampleRate: env.sentryTracesSampleRate
    });
    
    return true;
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error.message);
    return false;
  }
}

function captureException(error, context = {}) {
  if (!sentryInitialized) {
    return null;
  }

  return Sentry.captureException(error, {
    contexts: {
      custom: context
    }
  });
}

function captureMessage(message, level = 'info', context = {}) {
  if (!sentryInitialized) {
    return null;
  }

  return Sentry.captureMessage(message, {
    level,
    contexts: {
      custom: context
    }
  });
}

function setUser(user) {
  if (!sentryInitialized) {
    return;
  }

  Sentry.setUser(user);
}

function addBreadcrumb(breadcrumb) {
  if (!sentryInitialized) {
    return;
  }

  Sentry.addBreadcrumb(breadcrumb);
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
