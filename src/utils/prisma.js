const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = prisma;
