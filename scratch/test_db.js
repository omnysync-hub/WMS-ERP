const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.$queryRawUnsafe(`SELECT 1 as test`)
  .then(r => console.log('Raw query:', r))
  .catch(e => console.error('Raw query error:', e.message))
  .finally(() => p.$disconnect());
