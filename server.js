require('dotenv').config();
const app = require('./src/app');
const prisma = require('./src/common/prismaClient');
const cleanupJob = require('./src/common/jobs/cleanupJob');
const paymentResetJob = require('./src/common/jobs/resetStalePayments');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Cron jobs are already started in app.js, so no need to start again
});

async function shutdown(signal) {
  console.log(`${signal} received — shutting down gracefully`);
  cleanupJob.stop();
  paymentResetJob.stop();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});