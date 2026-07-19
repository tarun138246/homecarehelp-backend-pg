const env = require('../config/env');

module.exports = (err, req, res, next) => {
  console.error(err.stack || err);

  const status = err.status || 500;
  // Unexpected (unstatused) errors can carry raw Prisma/internal details —
  // don't leak those to clients outside development.
  const message = status === 500 && env.nodeEnv === 'production'
    ? 'Internal Server Error'
    : (err.message || 'Internal Server Error');

  res.status(status).json({ error: message });
};
