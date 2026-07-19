const authService = require('../services/authService');

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone_number, confirm_password } = req.body;
    const result = await authService.register({ name, email, password, confirm_password, phone_number });

    res.status(201).json({
      token: result.token,
      user: {
        id: result.user.user_id.toString(),
        name: result.user.name,
        email: result.user.email
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    res.json({
      token: result.token,
      user: {
        id: result.user.user_id.toString(),
        name: result.user.name,
        email: result.user.email
      }
    });
  } catch (err) {
    next(err);
  }
};
