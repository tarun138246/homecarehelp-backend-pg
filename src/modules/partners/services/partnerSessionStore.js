// In-memory store for e-signed-but-not-yet-paid partner agreements.
// Extracted from partnerService so the cleanup cron can prune stale entries
// without creating a circular dependency between the two.

const sessions = new Map(); // partnerId -> { signature, pdfBuffer, createdAt }

exports.set = (partnerId, signature, pdfBuffer) => {
  sessions.set(partnerId.toString(), { signature, pdfBuffer, createdAt: Date.now() });
};

exports.get = (partnerId) => sessions.get(partnerId.toString());

exports.delete = (partnerId) => sessions.delete(partnerId.toString());

exports.entries = () => sessions.entries();
