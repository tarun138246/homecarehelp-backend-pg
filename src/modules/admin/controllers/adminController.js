const superAdminService = require('../services/adminService');
const logger = require('../../../common/utils/logger');

exports.notImplemented = (req, res) => {
  res.status(501).json({ error: 'Admin module not implemented yet' });
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await superAdminService.authenticateSuperAdmin(email.trim(), password);
    res.json({ token: result.token, email: result.email });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({ error: err.message });
    }
    next(err);
  }
};

/**
 * GET /bookings – simplified list (name, phone, total_amount, address)
 */
exports.getBookings = async (req, res, next) => {
  try {
    const bookings = await superAdminService.getAllBookings();
    res.json({ bookings });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /booking/:id – single booking with full details (same format as old)
 */
exports.getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await superAdminService.getBookingById(id);
    res.json({ booking });
  } catch (err) {
    next(err);
  }
};