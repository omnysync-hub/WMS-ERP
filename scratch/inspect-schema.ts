import { prisma } from "../src/lib/prisma";

async function inspectSchema() {
  const productCols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'Product' OR table_name = 'product';
  `);
  console.log("Product columns:", productCols);

  const stockCols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'StockLedger' OR table_name = 'stockledger' OR table_name = 'stock_ledger';
  `);
  console.log("StockLedger columns:", stockCols);
}

inspectSchema().catch(console.error).finally(() => process.exit(0));
