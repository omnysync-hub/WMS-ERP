import { prisma } from "../src/lib/prisma";

async function inspectJobAndCustomer() {
  const jobCols: any[] = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'Job' OR table_name = 'job';
  `);
  console.log("Job columns:", jobCols.map((c: any) => c.column_name));

  const custCols: any[] = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'Customer' OR table_name = 'customer';
  `);
  console.log("Customer columns:", custCols.map((c: any) => c.column_name));
}

inspectJobAndCustomer().catch(console.error).finally(() => process.exit(0));
