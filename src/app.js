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

// CORS Configuration - MUST be before any other middleware
const allowedOrigins = env.corsOrigins || [
  'https://www.homecarehelp.in',
  'https://homecarehelp.in',
  'https://homecarehelp-admin.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

console.log('[CORS] Allowed origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) {
      console.log('[CORS] Request with no origin - allowing');
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log('[CORS] Allowed origin:', origin);
      return callback(null, true);
    }
    
    console.warn(`[CORS] BLOCKED origin: ${origin}`);
    console.warn(`[CORS] Allowed origins are:`, allowedOrigins);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Origin', 'X-Forwarded-For'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Handle preflight OPTIONS requests FIRST (before any other middleware)
app.options('*', cors(corsOptions));

// Apply CORS to all routes
app.use(cors(corsOptions));

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// ============================================================
// WEBHOOK RAW BODY PARSERS
// Must come BEFORE express.json()
// ============================================================

// NEW unified webhook endpoint (for both bookings and partners)
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

app.use('/health', healthRoutes);
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', webhookRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

if (sentryEnabled) {
  sentryConfig.setupExpress(app);
}

app.use(errorHandler);

cleanupJob.start();
paymentResetJob.start();
partnerStaleCleanup.start();

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