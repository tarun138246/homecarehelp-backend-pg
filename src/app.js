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

// ===== CORS - MUST be before helmet and other middleware =====
const allowedOrigins = env.corsOrigins && env.corsOrigins.length 
  ? env.corsOrigins 
  : [
      'https://www.homecarehelp.in',
      'https://homecarehelp.in',
      'http://localhost:3000',
      'http://localhost:3001'
    ];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-CSRF-Token', 
    'X-Requested-With', 
    'Accept',
    'Origin'
  ],
  credentials: true,
  maxAge: 86400 // Cache preflight for 24 hours
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Now helmet after CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow cross-origin resource sharing
}));

app.use(compression());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// Special handling for webhook endpoints - capture raw body BEFORE JSON parsing
// This is required for webhook signature verification
app.use('/api/partner/confirm-order-wb', express.raw({ type: 'application/json', limit: '5mb' }), (req, res, next) => {
  // express.raw() stores the raw body in req.body as a Buffer
  req.rawBody = req.body.toString('utf8');
  try {
    req.body = JSON.parse(req.rawBody);
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid JSON in webhook payload' });
  }
});

// Standard JSON parsing for all other routes
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use('/health', healthRoutes);

// Mount routes
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api', bookingPaymentRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/admin', adminRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use(errorHandler);

// Initialize cron jobs
cleanupJob.start();
paymentResetJob.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  cleanupJob.stop();
  paymentResetJob.stop();
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  cleanupJob.stop();
  paymentResetJob.stop();
});

module.exports = app;