
exports.notImplemented = (req, res) => {
  res.status(501).json({ error: 'Admin module not implemented yet' });
};
const superAdminService = require('../services/adminService');
const logger = require('../../../common/utils/logger');

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

exports.getBookings = async (req, res, next) => {
  try {
    const bookings = await superAdminService.getAllBookings();
    res.json({ bookings });
  } catch (err) {
    next(err);
  }
};