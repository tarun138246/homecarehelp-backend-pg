const userService = require('../services/userService');

exports.getProfile = async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user.userId);
    res.json(profile);
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const updated = await userService.updateProfile(req.user.userId, req.body);
    res.json({ message: 'Profile updated', user: updated });
  } catch (err) {
    next(err);
  }
};
