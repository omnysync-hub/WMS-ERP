import { prisma } from "../src/lib/prisma";

async function inspectDatabaseState() {
  console.log("=== DATABASE REALITY CHECK ===");

  // 1. Table row counts
  const accountCount = await prisma.account.count();
  const jeCount = await prisma.journalEntry.count();
  const jlCount = await prisma.journalLine.count();
  const invoiceCount = await prisma.invoice.count();
  const techLedgerCount = await prisma.technicianLedgerEntry.count();
  const vendorCount = await prisma.vendor.count();
  const periodsCount = await prisma.fiscalPeriod.count();

  console.log("1. Current Table Row Counts:");
  console.log(`   Account: ${accountCount}`);
  console.log(`   JournalEntry: ${jeCount}`);
  console.log(`   JournalLine: ${jlCount}`);
  console.log(`   Invoice: ${invoiceCount}`);
  console.log(`   TechnicianLedgerEntry: ${techLedgerCount}`);
  console.log(`   Vendor: ${vendorCount}`);
  console.log(`   FiscalPeriod: ${periodsCount}`);

  // 2. Check Account codes in DB
  const standardCodes = ["3900", "3200", "1500", "1590", "6350", "2200", "1000", "1010", "1100", "2000", "4000", "5000", "6100"];
  const accountsInDb = await prisma.account.findMany({
    where: { code: { in: standardCodes } },
    select: { id: true, code: true, name: true, type: true, createdAt: true },
  });
  console.log("\n2. Status of Standard Accounts in DB:");
  accountsInDb.forEach((a) => {
    console.log(`   - Code ${a.code}: "${a.name}" (${a.type}), created ${a.createdAt.toISOString()}`);
  });

  // Check all account codes in DB
  const allAccounts = await prisma.account.findMany({
    select: { code: true, name: true },
    orderBy: { code: "asc" },
  });
  console.log(`\n   All ${allAccounts.length} Account Codes currently in DB:`);
  console.log(allAccounts.map((a) => `${a.code}:${a.name}`).join(", "));

  // 3. Check JournalEntries with fiscalPeriodId
  const nullPeriodCount = await prisma.journalEntry.count({
    where: { fiscalPeriodId: null },
  });
  const notNullPeriodCount = await prisma.journalEntry.count({
    where: { fiscalPeriodId: { not: null } },
  });
  console.log("\n3. Journal Entries fiscalPeriodId Breakdown:");
  console.log(`   Entries with fiscalPeriodId = NULL: ${nullPeriodCount}`);
  console.log(`   Entries with fiscalPeriodId assigned: ${notNullPeriodCount}`);

  // Inspect some of the null period entries
  const sampleNullEntries = await prisma.journalEntry.findMany({
    where: { fiscalPeriodId: null },
    take: 5,
    select: { id: true, date: true, memo: true, refType: true, status: true },
  });
  console.log("   Sample NULL period entries:", sampleNullEntries);

  // 4. Try raw Prisma UPDATE on a JournalLine (direct DB call)
  console.log("\n4. Testing Raw Prisma Update bypassing Service Layer:");
  const sampleLine = await prisma.journalLine.findFirst({
    include: { journalEntry: true },
  });
  if (sampleLine) {
    console.log(`   Found JournalLine #${sampleLine.id} on JournalEntry #${sampleLine.journalEntryId} (Debit: ${sampleLine.debit}, Credit: ${sampleLine.credit})`);
    try {
      const originalDebit = sampleLine.debit;
      const updated = await prisma.journalLine.update({
        where: { id: sampleLine.id },
        data: { debit: originalDebit + 1 },
      });
      console.log(`   ⚠️ RAW PRISMA UPDATE SUCCEEDED! Mutated debit from ${originalDebit} to ${updated.debit}.`);
      // Revert it immediately
      await prisma.journalLine.update({
        where: { id: sampleLine.id },
        data: { debit: originalDebit },
      });
      console.log(`   Reverted back to original debit: ${originalDebit}.`);
    } catch (dbErr: any) {
      console.log(`   ✓ DB-Level constraint BLOCKED the update: "${dbErr.message}"`);
    }
  }

  // 5. Check Vendors in DB
  const vendorsInDb = await prisma.vendor.findMany();
  console.log("\n5. Vendors in DB & WHT Rates:");
  vendorsInDb.forEach((v) => {
    console.log(`   - ${v.name}: NTN ${v.ntnNumber || "none"}, WHT ${v.whtRate}%, Exempt: ${v.whtExempt}`);
  });

  // 6. Check CompanySettings
  const settings = await prisma.companySettings.findFirst();
  console.log("\n6. Company Settings:");
  console.log(settings);
}

inspectDatabaseState()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
