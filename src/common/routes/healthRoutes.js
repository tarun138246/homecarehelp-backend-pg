const router = require('express').Router();
const prisma = require('../prismaClient');

router.get('/', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'up', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'down', error: err.message });
  }
});

module.exports = router;
