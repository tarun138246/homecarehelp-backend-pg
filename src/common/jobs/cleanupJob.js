// Runs every 24 hour and clears the agreements that are there in the disk or RAM of partners who had not completed payment in 24 hours
const cron = require('node-cron');
const partnerService = require('../../modules/partners/services/partnerService');

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const SCHEDULE = '0 0 * * *'; // once a day, midnight server time

let task = null;

async function runCleanup() {
  try {
    const removed = await partnerService.pruneStaleAgreements(MAX_AGE_MS);
    if (removed > 0) {
      console.log(`[cleanupJob] Pruned ${removed} stale partner agreement session/file(s)`);
    }
  } catch (err) {
    console.error('[cleanupJob] Failed to prune stale partner agreements:', err.message);
  }
}

function start() {
  if (task) return task;
  task = cron.schedule(SCHEDULE, runCleanup);
  console.log(`[cleanupJob] Scheduled — clears data older than 24h, runs "${SCHEDULE}"`);
  return task;
}

function stop() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { start, stop, runCleanup };
