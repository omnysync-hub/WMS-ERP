/**
 * Idempotent backfill: link every ERP user to an HR employee (match by email/phone), or create one.
 * Employees without an ERP user (e.g. technicians) are left untouched. Never copies passwords.
 * Usage: npx tsx --tsconfig tsconfig.json scripts/backfill-user-employees.ts [--dry-run]
 */
import { prisma } from "@/lib/prisma";
import { linkOrCreateEmployeeForUser } from "@/lib/hr/userEmployeeLink";
import { HrmService } from "@/lib/services/HrmService";

(async () => {
  const dry = process.argv.includes("--dry-run");
  const users = await prisma.erpUser.findMany({ orderBy: { createdAt: "asc" } });
  const counts = { users: users.length, already_linked: 0, linked_existing: 0, created: 0, skipped_demo: 0 };
  for (const u of users) {
    if (u.isDemo) { counts.skipped_demo++; continue; }
    if (dry) {
      const linked = await prisma.employee.findUnique({ where: { erpUserId: u.id } });
      console.log(`@${u.username}: ${linked ? "already linked" : "would link/create"}`);
      continue;
    }
    const res = await prisma.$transaction((tx) => linkOrCreateEmployeeForUser(tx, u));
    if (res.action === "created") await HrmService.initEmployeeLeaveBalances(res.employee.id).catch(() => null);
    counts[res.action]++;
    console.log(`@${u.username}: ${res.action} -> ${res.employee.name}`);
  }
  console.log(JSON.stringify({ dryRun: dry, ...counts }));
  process.exit(0);
})().catch((e) => { console.error("Backfill failed:", e?.message); process.exit(1); });
