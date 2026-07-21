const { captureMessage, captureException, addBreadcrumb } = require('../config/sentry');

/**
 * Custom logger that logs to console AND Sentry
 */
class Logger {
  log(message, context = {}) {
    console.log(message, context);
    
    // Add as breadcrumb in Sentry
    addBreadcrumb({
      category: 'log',
      message: typeof message === 'string' ? message : JSON.stringify(message),
      level: 'info',
      data: context
    });
  }

  info(message, context = {}) {
    console.log(`[INFO] ${message}`, context);
    
    addBreadcrumb({
      category: 'info',
      message: typeof message === 'string' ? message : JSON.stringify(message),
      level: 'info',
      data: context
    });
  }

  warn(message, context = {}) {
    console.warn(`[WARN] ${message}`, context);
    
    // Send warnings to Sentry
    captureMessage(message, 'warning', context);
  }

  error(message, error = null, context = {}) {
    console.error(`[ERROR] ${message}`, error, context);
    
    if (error instanceof Error) {
      // Capture as exception
      captureException(error, context);
    } else {
      // Capture as error message
      captureMessage(message, 'error', context);
    }
  }

  debug(message, context = {}) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${message}`, context);
    }
    
    addBreadcrumb({
      category: 'debug',
      message: typeof message === 'string' ? message : JSON.stringify(message),
      level: 'debug',
      data: context
    });
  }

  // Webhook specific logging
  webhook(message, context = {}) {
    const logMessage = `[Webhook] ${message}`;
    console.log(logMessage, context);
    
    addBreadcrumb({
      category: 'webhook',
      message,
      level: 'info',
      data: context
    });
  }

  webhookError(message, error = null, context = {}) {
    const logMessage = `[Webhook Error] ${message}`;
    console.error(logMessage, error, context);
    
    if (error instanceof Error) {
      captureException(error, { ...context, component: 'webhook' });
    } else {
      captureMessage(logMessage, 'error', { ...context, component: 'webhook' });
    }
  }

  // Payment specific logging
  payment(message, context = {}) {
    const logMessage = `[Payment] ${message}`;
    console.log(logMessage, context);
    
    addBreadcrumb({
      category: 'payment',
      message,
      level: 'info',
      data: context
    });
  }

  paymentError(message, error = null, context = {}) {
    const logMessage = `[Payment Error] ${message}`;
    console.error(logMessage, error, context);
    
    if (error instanceof Error) {
      captureException(error, { ...context, component: 'payment' });
    } else {
      captureMessage(logMessage, 'error', { ...context, component: 'payment' });
    }
  }
}

const logger = new Logger();

module.exports = logger;
