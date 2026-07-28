const cron = require('node-cron');
const partnerService = require('../../modules/partners/services/partnerService');

const SCHEDULE = '*/30 * * * *'; // every 30 minutes

let task = null;

async function runCleanup() {
  try {
    const deletedCount = await partnerService.deleteStalePartners();
    if (deletedCount > 0) {
      console.log(`[stalePartnerCleanup] Deleted ${deletedCount} stale partner(s) with status "created" or "payment_pending"`);
    }
  } catch (err) {
    console.error('[stalePartnerCleanup] Failed:', err.message);
  }
}

function start() {
  if (task) return task;
  task = cron.schedule(SCHEDULE, runCleanup);
  console.log(`[stalePartnerCleanup] Scheduled — runs every 30 minutes (${SCHEDULE})`);
  return task;
}

function stop() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { start, stop, runCleanup };