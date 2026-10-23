import type { Account, Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Technician / office expense categories (Accounts > Setup > Expense categories) each point to a
 * ledger account, e.g. Fuel -> 5100 Job Fuel & Conveyance, Office supplies -> 6210.
 * Returns a lookup so payouts can post each claim to the account of ITS category.
 * A claim with no (or an unknown / retired) category falls back to the mapped default account.
 */
export async function loadExpenseCategoryAccounts(db: Db): Promise<(category?: string | null) => Account | null> {
  const settings = await (db as PrismaClient).companySettings.findFirst({ select: { expenseCategories: true } });
  const rows: Array<{ id?: string; code?: string; name?: string; accountId?: string; active?: boolean }> = Array.isArray(
    settings?.expenseCategories
  )
    ? (settings!.expenseCategories as any[])
    : [];
  const ids = Array.from(new Set(rows.map((r) => r.accountId).filter((v): v is string => !!v)));
  const accounts = ids.length ? await (db as PrismaClient).account.findMany({ where: { id: { in: ids } } }) : [];
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return (category?: string | null) => {
    const key = (category || "").trim().toLowerCase();
    if (!key) return null;
    const row = rows.find(
      (r) => (r.code || "").toLowerCase() === key || (r.id || "").toLowerCase() === key || (r.name || "").toLowerCase() === key
    );
    const acc = row?.accountId ? byId.get(row.accountId) : undefined;
    if (!acc || !acc.isActive || acc.level < 4 || acc.type !== "expense") return null;
    return acc;
  };
}
