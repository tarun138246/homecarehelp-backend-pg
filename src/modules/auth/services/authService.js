const bcrypt = require('bcrypt');
const { signToken } = require('../../../common/utils/jwt');
const userRepo = require('../../users/repositories/userRepository');

// OTP verification is out of scope for now; only email/password is supported.
// Kept isolated in this module so an `otp` sub-flow can be added later
// without touching login/register.

exports.register = async ({ name, email, password, confirm_password, phone_number }) => {
  if (password !== confirm_password) {
    throw Object.assign(new Error('Passwords do not match'), { status: 400 });
  }

  const existingEmail = await userRepo.findByEmail(email);
  if (existingEmail) throw Object.assign(new Error('Email already exists'), { status: 409 });

  const existingPhone = await userRepo.findByPhone(phone_number);
  if (existingPhone) throw Object.assign(new Error('Phone number already exists'), { status: 409 });

  const hashed = await bcrypt.hash(password, 10);
  // confirm_password is validated above and never persisted.
  const user = await userRepo.create({
    name,
    email,
    password: hashed,
    phone_number
  });

  const token = signToken({ userId: user.user_id.toString(), email: user.email });
  return { user, token };
};

exports.login = async ({ email, password }) => {
  const user = await userRepo.findByEmail(email);
  if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  await userRepo.updateLastLogin(user.user_id);

  const token = signToken({ userId: user.user_id.toString(), email: user.email });
  return { user, token };
};
