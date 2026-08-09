require('dotenv').config();
const sentryConfig = require('./common/config/sentry');
const sentryEnabled = sentryConfig.initSentry();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const errorHandler = require('./common/middlewares/errorHandler');
const { apiLimiter, authLimiter } = require('./common/middlewares/rateLimiter');
const env = require('./common/config/env');
const corsOrigins = require('./common/config/cors');

const cleanupJob = require('./common/jobs/cleanupJob');
const paymentResetJob = require('./common/jobs/resetStalePayments');
const partnerStaleCleanup = require('./common/jobs/partnerStaleRecordCleanup');

const healthRoutes = require('./common/routes/healthRoutes');
const authRoutes = require('./modules/auth/routes/authRoutes');
const userRoutes = require('./modules/users/routes/userRoutes');
const serviceRoutes = require('./modules/services/routes/serviceRoutes');
const bookingRoutes = require('./modules/bookings/routes/bookingRoutes');
const partnerRoutes = require('./modules/partners/routes/partnerRoutes');
const adminRoutes = require('./modules/admin/routes/adminRoutes');
const webhookRoutes = require('./modules/webhooks/routes/webhookRoutes');

const app = express();

app.set('trust proxy', 1);

// ------------------------------------------------
// CORS CONFIGURATION
// ------------------------------------------------
console.log('[CORS] Allowed origins:', corsOrigins);

app.use(cors({
  origin: corsOrigins,                
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Origin', 'X-Forwarded-For'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400,                     // 24 hours
  optionsSuccessStatus: 204,
}));

// ------------------------------------------------
// Security & utility middlewares
// ------------------------------------------------
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// ============================================================
// WEBHOOK RAW BODY PARSERS
// Must come BEFORE express.json()
// ============================================================

app.use('/api/confirm-order-wb', express.raw({ type: 'application/json', limit: '5mb' }), (req, res, next) => {
  req.rawBody = req.body.toString('utf8');
  try {
    req.body = JSON.parse(req.rawBody);
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid JSON in webhook payload' });
  }
});

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ------------------------------------------------
// Routes
// ------------------------------------------------
app.use('/health', healthRoutes);
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', webhookRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Sentry error handler (if enabled)
if (sentryEnabled) {
  sentryConfig.setupExpress(app);
}

// Global error handler
app.use(errorHandler);

// ------------------------------------------------
// Start background jobs
// ------------------------------------------------
cleanupJob.start();
paymentResetJob.start();
partnerStaleCleanup.start();

// Graceful shutdown signals (app level)
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down...');
  cleanupJob.stop();
  paymentResetJob.stop();
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down...');
  cleanupJob.stop();
  paymentResetJob.stop();
});

module.exports = app;