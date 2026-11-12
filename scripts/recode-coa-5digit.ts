/**
 * Accounts Linking migration: recode the chart of accounts to the 5-digit scheme, add the new
 * ledgers, fix 15190 to contra-asset, and apply the new / changed account mappings.
 *
 *   npx tsx scripts/recode-coa-5digit.ts --dry-run   # show what would change, roll back
 *   npx tsx scripts/recode-coa-5digit.ts             # apply (one transaction)
 *
 * Safe to run more than once. Accounts keep their id, so every journal line, mapping, care-of
 * ledger and financial account stays linked; only codes / names / parents change.
 */
import { PrismaClient } from "@prisma/client";
import { STANDARD_COA_DEFINITIONS, LEGACY_ACCOUNT_CODE_MAP } from "../src/lib/constants/chartOfAccountsHierarchy";
import { BASELINE_MAPPINGS, ACCOUNTS_LINKING_REMAPS } from "../src/lib/constants/baselineMappings";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry-run");
const COMPANY = "DEFAULT";

class DryRunRollback extends Error {}

async function main() {
  const log: string[] = [];
  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Recode: ledgers first (5-digit targets never collide), then groups (whose new 4-digit
        //    codes may equal an OLD ledger code that step 1 has just freed).
        const ordered = [...STANDARD_COA_DEFINITIONS.filter((d) => !d.isGroup), ...STANDARD_COA_DEFINITIONS.filter((d) => d.isGroup)];
        for (const def of ordered) {
          if (!def.legacyCode) continue;
          const already = await tx.account.findUnique({ where: { code: def.code } });
          if (already) continue;
          const old = await tx.account.findUnique({ where: { code: def.legacyCode } });
          if (!old) continue;
          await tx.account.update({
            where: { id: old.id },
            data: { code: def.code, name: def.name, type: def.type, level: def.level, description: def.description ?? old.description },
          });
          log.push(`recode  ${def.legacyCode.padEnd(9)} -> ${def.code.padEnd(6)} ${def.name}`);
        }

        // 2. Create missing groups / ledgers (parents before children).
        const byLevel = [...STANDARD_COA_DEFINITIONS].sort((a, b) => a.level - b.level);
        for (const def of byLevel) {
          const existing = await tx.account.findUnique({ where: { code: def.code } });
          if (existing) continue;
          const parent = def.parentCode ? await tx.account.findUnique({ where: { code: def.parentCode } }) : null;
          await tx.account.create({
            data: {
              code: def.code,
              name: def.name,
              type: def.type,
              level: def.level,
              description: def.description,
              parentId: parent?.id ?? null,
              isSystem: true,
              companyId: COMPANY,
            },
          });
          log.push(`create  ${def.code.padEnd(6)} ${def.name}`);
        }

        // 3. Parent / type / level per the standard chart (fixes 15190 contra-asset, new L3 groups).
        for (const def of STANDARD_COA_DEFINITIONS) {
          const acc = await tx.account.findUnique({ where: { code: def.code } });
          if (!acc) continue;
          const parent = def.parentCode ? await tx.account.findUnique({ where: { code: def.parentCode } }) : null;
          const parentId = parent?.id ?? null;
          if (acc.parentId !== parentId || acc.type !== def.type || acc.level !== def.level) {
            await tx.account.update({ where: { id: acc.id }, data: { parentId, type: def.type, level: def.level } });
            log.push(`fix     ${def.code.padEnd(6)} parent=${def.parentCode ?? "-"} type=${def.type}`);
          }
        }

        // 4. Custom (non-standard) accounts still parked under an old -GRP code are already
        //    re-linked by id; nothing to do. Report any leftover old-format codes.
        const leftovers = await tx.account.findMany({ where: { code: { endsWith: "-GRP" } }, select: { code: true, name: true } });
        for (const l of leftovers) log.push(`WARN    leftover group ${l.code} ${l.name} (custom group, left as is)`);

        // 5. Mappings: create the missing ones; re-point the rules the review changed.
        for (const m of BASELINE_MAPPINGS) {
          const target = await tx.account.findUnique({ where: { code: m.accountCode } });
          if (!target) {
            log.push(`WARN    mapping ${m.transactionType}: account ${m.accountCode} missing`);
            continue;
          }
          const current = await tx.accountMapping.findFirst({
            where: { companyId: COMPANY, transactionType: m.transactionType, categoryScope: null },
            include: { account: true },
          });
          const forced = ACCOUNTS_LINKING_REMAPS[m.transactionType];
          if (!current) {
            await tx.accountMapping.create({
              data: { companyId: COMPANY, transactionType: m.transactionType, categoryScope: null, accountId: target.id, updatedBy: "accounts-linking-migration" },
            });
            log.push(`map+    ${m.transactionType} -> ${m.accountCode}`);
          } else if (forced && current.accountId !== target.id) {
            await tx.accountMapping.update({ where: { id: current.id }, data: { accountId: target.id, updatedBy: "accounts-linking-migration" } });
            log.push(`map~    ${m.transactionType}: ${current.account.code} -> ${m.accountCode}`);
          }
        }

        // 6. Account codes stored as text.
        const recode = (c: string | null | undefined) => (c && LEGACY_ACCOUNT_CODE_MAP[c]) || null;
        for (const fa of await tx.fixedAsset.findMany()) {
          const data: Record<string, string> = {};
          const a = recode(fa.assetAccountCode);
          const b = recode(fa.accumDeprAccountCode);
          const c = recode(fa.deprExpenseAccountCode);
          if (a) data.assetAccountCode = a;
          if (b) data.accumDeprAccountCode = b;
          if (c) data.deprExpenseAccountCode = c;
          if (Object.keys(data).length) {
            await tx.fixedAsset.update({ where: { id: fa.id }, data });
            log.push(`asset   ${fa.id} ${JSON.stringify(data)}`);
          }
        }
        for (const bl of await tx.bankStatementLine.findMany({ select: { id: true, bankAccountId: true } })) {
          const n = recode(bl.bankAccountId);
          if (n) await tx.bankStatementLine.update({ where: { id: bl.id }, data: { bankAccountId: n } });
        }

        if (DRY) throw new DryRunRollback();
      },
      { maxWait: 20000, timeout: 300000 }
    );
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }
  console.log(log.join("\n") || "(nothing to change)");
  console.log(`\n${log.length} change(s) ${DRY ? "would be made (DRY RUN, rolled back)" : "applied"}.`);
}

main()
  .catch((e) => {
    console.error("Migration failed, nothing was changed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
