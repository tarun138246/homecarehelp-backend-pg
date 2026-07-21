const sentryConfig = require('./common/config/sentry');
const sentryEnabled = sentryConfig.initSentry();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const sentryConfig = require('./common/config/sentry');
const errorHandler = require('./common/middlewares/errorHandler');
const { apiLimiter, authLimiter } = require('./common/middlewares/rateLimiter');
const env = require('./common/config/env');

const cleanupJob = require('./common/jobs/cleanupJob');
const paymentResetJob = require('./common/jobs/resetStalePayments');

const healthRoutes = require('./common/routes/healthRoutes');
const authRoutes = require('./modules/auth/routes/authRoutes');
const userRoutes = require('./modules/users/routes/userRoutes');
const serviceRoutes = require('./modules/services/routes/serviceRoutes');
const bookingRoutes = require('./modules/bookings/routes/bookingRoutes');
const bookingPaymentRoutes = require('./modules/bookings/routes/paymentRoutes');
const partnerRoutes = require('./modules/partners/routes/partnerRoutes');
const adminRoutes = require('./modules/admin/routes/adminRoutes');


const app = express();

app.set('trust proxy', 1);

// CORS
const allowedOrigins = [
  // Your frontend domains
  'https://www.homecarehelp.in',
  'https://homecarehelp.in',
  'http://localhost:3000',
  'http://localhost:3001',
  
 // CASHFREE Sandbox IP's
  '52.66.25.127',
  '15.206.45.168',
// Cashfree PROD IP's
  '52.66.101.190',
  '3.109.102.144',
  '18.60.134.245',
  '18.60.183.142',
  
  // Cashfree API URL
  'https://sandbox.cashfree.com',
  'https://api.cashfree.com',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  maxAge: 86400
}));

app.options('*', cors());

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// Webhook raw body
app.use('/api/partner/confirm-order-wb', express.raw({ type: 'application/json', limit: '5mb' }), (req, res, next) => {
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
app.use('/api', bookingPaymentRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Sentry error handler (v8+ way)
if (sentryEnabled) {
  sentryConfig.setupExpress(app);
}

// Custom error handler
app.use(errorHandler);

// Cron jobs
cleanupJob.start();
paymentResetJob.start();

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