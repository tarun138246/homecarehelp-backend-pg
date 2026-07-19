const userRepo = require('../repositories/userRepository');

exports.getProfile = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return {
    name: user.name,
    email: user.email,
    phoneNumber: user.phone_number
  };
};

exports.updateProfile = async (userId, updates) => {
  // Email change must be rejected outright if the field is present at all,
  // even as an empty string — not just when it's truthy.
  if (Object.prototype.hasOwnProperty.call(updates, 'email')) {
    throw Object.assign(new Error('Changing email is not allowed.'), { status: 400 });
  }

  const allowed = {};
  if (Object.prototype.hasOwnProperty.call(updates, 'name') && updates.name) {
    allowed.name = updates.name;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'phoneNumber') && updates.phoneNumber) {
    allowed.phone_number = updates.phoneNumber;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'phone_number') && updates.phone_number) {
    allowed.phone_number = updates.phone_number;
  }

  if (Object.keys(allowed).length === 0) {
    throw Object.assign(new Error('No valid fields to update'), { status: 400 });
  }

  const user = await userRepo.update(userId, allowed);
  return {
    name: user.name,
    email: user.email,
    phoneNumber: user.phone_number
  };
};
