const rateLimit = require('express-rate-limit');

// General API limiter — generous, just a backstop against abuse/scraping.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false
});

// Tighter limiter for auth endpoints to slow down credential-stuffing/brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' }
});

module.exports = { apiLimiter, authLimiter };
