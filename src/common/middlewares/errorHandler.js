const env = require('../config/env');

module.exports = (err, req, res, next) => {
  const status = err.status || 500;
  
  // Log all errors with context
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status,
    message: err.message,
    stack: env.nodeEnv === 'development' ? err.stack : undefined,
    body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
    query: req.query,
    params: req.params,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      'x-webhook-signature': req.headers['x-webhook-signature'] ? 'present' : undefined,
      'x-webhook-timestamp': req.headers['x-webhook-timestamp']
    }
  };

  console.error('[Error Handler]:', errorLog);

  // Unexpected (unstatused) errors can carry raw Prisma/internal details —
  // don't leak those to clients outside development.
  const message = status === 500 && env.nodeEnv === 'production'
    ? 'Internal Server Error'
    : (err.message || 'Internal Server Error');

  res.status(status).json({ error: message });
};
