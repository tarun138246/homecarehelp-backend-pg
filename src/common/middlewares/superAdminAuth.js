const { verifyToken } = require('../utils/jwt');

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = verifyToken(token);
    // Ensure this is a superadmin token
    if (decoded.type !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden: not a superadmin token' });
    }
    req.superadmin = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};