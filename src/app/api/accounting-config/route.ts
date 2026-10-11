export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveJobsActor } from "@/lib/auth/erpActor";
import { accountingPolicyReadiness } from "@/lib/accountingConfig";

export async function GET(req: NextRequest) {
  const resolved = await resolveJobsActor(req);
  if (resolved.error) return resolved.error;
  if (!resolved.actor.role || resolved.actor.role === "anonymous") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const [settings, financialAccounts] = await Promise.all([
    prisma.companySettings.findFirst(),
    prisma.financialAccount.findMany({
      where: { isActive: true },
      include: { ledgerAccount: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
  ]);

  if (!settings) {
    return NextResponse.json({
      invoice: { prefix: "", nextNumber: 1, padding: 4 },
      taxRules: [],
      paymentMethods: [],
      agingBuckets: [30, 60, 90],
      expenseCategories: [],
      financialAccounts: [],
      complete: false,
    });
  }

  const readiness = accountingPolicyReadiness(settings);
  const expenseAccountIds = [...new Set(readiness.expenseCategories.map((item) => item.accountId).filter(Boolean))];
  const expenseAccounts = expenseAccountIds.length ? await prisma.account.findMany({ where: { id: { in: expenseAccountIds } }, select: { id: true, code: true, name: true } }) : [];
  const expenseAccountMap = new Map(expenseAccounts.map((account) => [account.id, account]));
  return NextResponse.json({
    invoice: {
      prefix: settings.invoicePrefix,
      nextNumber: settings.invoiceNextNumber,
      padding: settings.invoiceNumberPadding,
    },
    taxRules: readiness.taxRules,
    paymentMethods: readiness.paymentMethods,
    agingBuckets: readiness.agingBuckets,
    expenseCategories: readiness.expenseCategories.map((item) => ({ ...item, account: expenseAccountMap.get(item.accountId) || null })),
    financialAccounts,
    complete: readiness.complete && settings.financialAccountsCompleted,
  });
}
