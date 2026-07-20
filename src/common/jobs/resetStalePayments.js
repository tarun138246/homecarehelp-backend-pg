// Runs every 24 hour and those partner whose payment are failed or dropped for more than 48 hours reset there payment data from DB
const cron = require('node-cron');
const partnerService = require('../../modules/partners/services/partnerService');

const SCHEDULE = '0 0 * * *'; // Run every 24 hours at midnight

let task = null;

async function runReset() {
  try {
    const result = await partnerService.resetStalePayments();
    console.log(`[paymentResetJob] Reset ${result.resetCount || 0} stale payment attempts`);
  } catch (err) {
    console.error('[paymentResetJob] Failed to reset stale payments:', err.message);
  }
}

function start() {
  if (task) return task;
  task = cron.schedule(SCHEDULE, runReset);
  console.log(`[paymentResetJob] Scheduled — resets payments stalled >48h, runs "${SCHEDULE}"`);
  return task;
}

function stop() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { start, stop, runReset };