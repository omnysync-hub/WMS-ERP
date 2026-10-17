const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    include: { journalLines: true },
    orderBy: { code: "asc" },
  });

  console.log("=== ACCOUNTS WITH JOURNAL LINES ===");
  for (const acc of accounts) {
    if (acc.journalLines.length > 0) {
      let dr = 0;
      let cr = 0;
      for (const l of acc.journalLines) {
        dr += l.debit;
        cr += l.credit;
      }
      const assetBal = dr - cr;
      const liabBal = cr - dr;
      console.log(
        `Code: ${acc.code.padEnd(8)} | Name: ${acc.name.padEnd(35)} | Type: ${acc.type.padEnd(10)} | Dr: ${String(dr).padStart(10)} | Cr: ${String(cr).padStart(10)} | Dr-Cr: ${String(assetBal).padStart(10)} | Cr-Dr: ${String(liabBal).padStart(10)} | Count: ${acc.journalLines.length}`
      );
    }
  }

  console.log("\n=== LAST 15 JOURNAL ENTRIES ===");
  const entries = await prisma.journalEntry.findMany({
    take: 15,
    orderBy: { createdAt: "desc" },
    include: {
      lines: {
        include: { account: true },
      },
    },
  });

  for (const e of entries) {
    console.log(`\nEntry: ${e.id} | Ref: ${e.refType} ${e.refId || ""} | Memo: ${e.memo} | Date: ${e.date}`);
    for (const l of e.lines) {
      console.log(`   Acc: ${l.account.code} (${l.account.name}) | Dr: ${l.debit} | Cr: ${l.credit}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
