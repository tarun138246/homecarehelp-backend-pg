// Placeholder only — no admin business logic implemented yet
// (login, bookings view, accept/reject, partner onboarding view, etc).

exports.notImplemented = (req, res) => {
  res.status(501).json({ error: 'Admin module not implemented yet' });
};
