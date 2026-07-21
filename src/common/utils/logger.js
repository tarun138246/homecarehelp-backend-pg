const { captureMessage, captureException, addBreadcrumb } = require('../config/sentry');

class Logger {
  log(message, context = {}) {
    console.log(message, context);
    
    try {
      addBreadcrumb({
        category: 'log',
        message: typeof message === 'string' ? message : JSON.stringify(message),
        level: 'info',
        data: context
      });
    } catch (err) {
      // Silently fail - don't let logging break the app
    }
  }

  info(message, context = {}) {
    console.log(`[INFO] ${message}`, context);
    
    try {
      addBreadcrumb({
        category: 'info',
        message: typeof message === 'string' ? message : JSON.stringify(message),
        level: 'info',
        data: context
      });
    } catch (err) {}
  }

  warn(message, context = {}) {
    console.warn(`[WARN] ${message}`, context);
    
    try {
      captureMessage(message, 'warning', context);
    } catch (err) {}
  }

  error(message, error = null, context = {}) {
    console.error(`[ERROR] ${message}`, error, context);
    
    try {
      if (error instanceof Error) {
        captureException(error, context);
      } else {
        captureMessage(message, 'error', context);
      }
    } catch (err) {}
  }

  debug(message, context = {}) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${message}`, context);
    }
    
    try {
      addBreadcrumb({
        category: 'debug',
        message: typeof message === 'string' ? message : JSON.stringify(message),
        level: 'debug',
        data: context
      });
    } catch (err) {}
  }

  webhook(message, context = {}) {
    const logMessage = `[Webhook] ${message}`;
    console.log(logMessage, context);
    
    try {
      addBreadcrumb({
        category: 'webhook',
        message,
        level: 'info',
        data: context
      });
    } catch (err) {}
  }

  webhookError(message, error = null, context = {}) {
    const logMessage = `[Webhook Error] ${message}`;
    console.error(logMessage, error, context);
    
    try {
      if (error instanceof Error) {
        captureException(error, { ...context, component: 'webhook' });
      } else {
        captureMessage(logMessage, 'error', { ...context, component: 'webhook' });
      }
    } catch (err) {}
  }

  payment(message, context = {}) {
    const logMessage = `[Payment] ${message}`;
    console.log(logMessage, context);
    
    try {
      addBreadcrumb({
        category: 'payment',
        message,
        level: 'info',
        data: context
      });
    } catch (err) {}
  }

  paymentError(message, error = null, context = {}) {
    const logMessage = `[Payment Error] ${message}`;
    console.error(logMessage, error, context);
    
    try {
      if (error instanceof Error) {
        captureException(error, { ...context, component: 'payment' });
      } else {
        captureMessage(logMessage, 'error', { ...context, component: 'payment' });
      }
    } catch (err) {}
  }
}

const logger = new Logger();

module.exports = logger;