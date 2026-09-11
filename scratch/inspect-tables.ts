import { prisma } from "../src/lib/prisma";

async function inspectAllTables() {
  const tables: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log("All tables:", tables.map((t: any) => t.table_name));
}

inspectAllTables().catch(console.error).finally(() => process.exit(0));
