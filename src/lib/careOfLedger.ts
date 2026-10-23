import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Chart-of-accounts code used for care-of (referring company) receivables.
 * The client's chart has one receivables account (1100 Accounts Receivable); every care-of company
 * keeps its own sub-ledger balance under it.
 */
export const CARE_OF_RECEIVABLE_CODE = "1100";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * The ledger every new care-of party is linked to by default. Throws a clear error when the
 * account is missing or not a postable asset account, so no care-of party is created unlinked.
 */
export async function careOfReceivableAccountId(db: Db): Promise<string> {
  const account = await db.account.findFirst({ where: { code: CARE_OF_RECEIVABLE_CODE } });
  if (!account || !account.isActive || account.type !== "asset" || (account as any).isGroup) {
    throw new Error(`Care-of receivables account ${CARE_OF_RECEIVABLE_CODE} is missing or inactive. Fix it in the Chart of Accounts first.`);
  }
  return account.id;
}

/** Create a care-of party already linked to the care-of receivables ledger, in one transaction. */
export async function createCareOfParty(
  db: PrismaClient,
  data: { companyName: string; personName?: string; phone?: string | null; ledgerAccountId?: string | null }
) {
  return db.$transaction(async (tx) => {
    const ledgerAccountId = data.ledgerAccountId || (await careOfReceivableAccountId(tx));
    return tx.careOfParty.create({
      data: { companyName: data.companyName, personName: data.personName || "", phone: data.phone || null, ledgerAccountId },
    });
  });
}
