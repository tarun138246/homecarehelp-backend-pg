// The Prisma schema generates the client to a custom `../generated/prisma`
// output path, so it must be imported from there directly rather than the
// `@prisma/client` package entry (which expects the default location).
const { PrismaClient } = require('../../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');

// Prisma 7's generated client uses the new "client" query engine, which
// requires an explicit driver adapter instead of just a datasource URL.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
