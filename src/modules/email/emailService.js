// src/modules/email/emailService.js

const nodemailer = require('nodemailer');
const env = require('../../common/config/env'); // adjust path to your env config
const { captureException, captureMessage } = require('../../common/config/sentry');
const logger = require('../../common/utils/logger');

// SMTP configuration for Brevo
const SMTP_CONFIG = {
  host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.BREVO_SMTP_PORT, 10) || 587,
  secure: false, // true for 465, false for other ports (Brevo uses STARTTLS on 587)
  auth: {
    user: process.env.BREVO_SMTP_USER || '',   // e.g. a375ff001@smtp-brevo.com
    pass: process.env.BREVO_SMTP_PASS || '',   // e.g. z3kH9RO2st58AvhY
  },
  // Optional: if you want to set a connection timeout
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 15000,
};

let transporter = null;

/**
 * Initializes and returns the Nodemailer transporter.
 * The transporter is created once and reused.
 */
function getTransporter() {
  if (transporter) {
    return transporter;
  }

  // Validate required credentials
  if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
    const errMsg = 'Brevo SMTP credentials are missing. Set BREVO_SMTP_USER and BREVO_SMTP_PASS in .env';
    logger.error(errMsg);
    captureMessage(errMsg, 'error');
    // In development, you may want to continue, but in production it's critical
    if (env.nodeEnv === 'production') {
      throw new Error(errMsg);
    }
    // For non-production, return a mock or null (optional)
    console.warn('[EmailService] SMTP not configured; emails will not be sent.');
    return null;
  }

  transporter = nodemailer.createTransport(SMTP_CONFIG);

  // Verify connection configuration (optional, but good to catch errors early)
  transporter.verify(function (error, success) {
    if (error) {
      logger.error('SMTP connection verification failed:', error);
      captureException(error, { component: 'email' });
      // transporter is still created; it will retry when sending
    } else {
      logger.info('SMTP server is ready to send emails');
    }
  });

  return transporter;
}

/**
 * Core send mail function.
 * @param {Object} options
 * @param {string} options.to - Recipient email (required)
 * @param {string} options.subject - Email subject (required)
 * @param {string} [options.html] - HTML body
 * @param {string} [options.text] - Plain text body (used if html is not provided)
 * @param {Array}  [options.attachments] - Array of attachment objects
 * @param {string} [options.from] - Sender address (default: EMAIL_FROM or 'noreply@homecarehelp.in')
 * @param {string} [options.cc] - CC recipients
 * @param {string} [options.bcc] - BCC recipients
 * @param {Object} [options.headers] - Custom headers
 * @returns {Promise<Object>} - Nodemailer send result
 */
async function sendMail({
  to,
  subject,
  html,
  text,
  attachments,
  from,
  cc,
  bcc,
  headers,
}) {
  // Validate required fields
  if (!to) {
    throw new Error('Recipient email (to) is required');
  }
  if (!subject) {
    throw new Error('Email subject is required');
  }

  const transport = getTransporter();
  if (!transport) {
    throw new Error('Email transporter is not available');
  }

  // Build mail options
  const mailOptions = {
    from: from || process.env.EMAIL_FROM || 'noreply@homecarehelp.in',
    to,
    subject,
    cc,
    bcc,
    html,
    text: text || (html ? undefined : ''), 
    attachments,
    headers,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    logger.info('Email sent successfully', {
      messageId: info.messageId,
      to,
      subject,
    });
    return info;
  } catch (error) {
    logger.error('Failed to send email', error, { to, subject });
    captureException(error, { to, subject, component: 'email' });
    throw error; // rethrow to let caller handle
  }
}

/**
 * Convenience method: sends a simple text email.
 */
async function sendTextEmail(to, subject, text, options = {}) {
  return sendMail({ ...options, to, subject, text });
}

/**
 * Convenience method: sends an HTML email.
 */
async function sendHtmlEmail(to, subject, html, options = {}) {
  return sendMail({ ...options, to, subject, html });
}

module.exports = {
  sendMail,
  sendTextEmail,
  sendHtmlEmail,
  getTransporter, 
};