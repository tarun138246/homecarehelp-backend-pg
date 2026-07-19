const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const errorHandler = require('./common/middlewares/errorHandler');
const { apiLimiter, authLimiter } = require('./common/middlewares/rateLimiter');
const env = require('./common/config/env');

const healthRoutes = require('./common/routes/healthRoutes');
const authRoutes = require('./modules/auth/routes/authRoutes');
const userRoutes = require('./modules/users/routes/userRoutes');
const serviceRoutes = require('./modules/services/routes/serviceRoutes');
const bookingRoutes = require('./modules/bookings/routes/bookingRoutes');
const bookingPaymentRoutes = require('./modules/bookings/routes/paymentRoutes');
const partnerRoutes = require('./modules/partners/routes/partnerRoutes');
const adminRoutes = require('./modules/admin/routes/adminRoutes');

const app = express();

app.set('trust proxy', 1); // needed behind nginx/a load balancer for correct req.ip in rate limiting

app.use(helmet());
app.use(cors({ origin: env.corsOrigins.length ? env.corsOrigins : true }));
app.use(compression());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '5mb' }));

app.use('/health', healthRoutes);

// Mount routes
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api', bookingPaymentRoutes); // /api/create-order, /api/confirm-order
app.use('/api/partner', partnerRoutes);
app.use('/api/admin', adminRoutes); // placeholder only

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use(errorHandler);

module.exports = app;
