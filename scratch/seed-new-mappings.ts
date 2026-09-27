import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const NEW = [
  { transactionType: "fixed_asset_cost", accountCode: "1500" },
  { transactionType: "bank_operating", accountCode: "1010" },
  { transactionType: "ar_control", accountCode: "1100" },
  { transactionType: "ap_control", accountCode: "2000" },
];
async function main() {
  const companyId = "DEFAULT";
  for (const m of NEW) {
    const acc = await prisma.account.findUnique({ where: { code: m.accountCode } });
    if (!acc) { console.log("SKIP missing account", m.accountCode); continue; }
    const existing = await prisma.accountMapping.findFirst({
      where: { companyId, transactionType: m.transactionType, categoryScope: null },
    });
    if (existing) {
      await prisma.accountMapping.update({ where: { id: existing.id }, data: { accountId: acc.id, updatedBy: "COA Onboarding Build" } });
      console.log("UPDATED", m.transactionType, "->", m.accountCode);
    } else {
      await prisma.accountMapping.create({
        data: { companyId, transactionType: m.transactionType, categoryScope: null, accountId: acc.id, updatedBy: "COA Onboarding Build" },
      });
      console.log("CREATED", m.transactionType, "->", m.accountCode);
    }
  }
}
main().finally(() => prisma.$disconnect());
