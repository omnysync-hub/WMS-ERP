/**
 * Account type rules shared by the posting engine, reports and the COA screens.
 * Pure (no prisma) so client components can import it too.
 *
 *   asset / expense / contra_revenue          -> normal DEBIT balance
 *   liability / equity / revenue /
 *   contra_asset / contra_expense             -> normal CREDIT balance
 *
 * Contra accounts sit inside their parent class and reduce it:
 *   contra_asset   (15190 Accumulated Depreciation) reduces total assets
 *   contra_revenue (41201 Sales Returns, 41202 Discounts) reduces revenue
 *   contra_expense (51106 Purchase Returns) reduces cost of sales
 */
export const ACCOUNT_TYPES = [
  "asset",
  "contra_asset",
  "liability",
  "equity",
  "revenue",
  "contra_revenue",
  "expense",
  "contra_expense",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: "Asset",
  contra_asset: "Contra-Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  contra_revenue: "Contra-Revenue",
  expense: "Expense",
  contra_expense: "Contra-Expense",
};

const DEBIT_NORMAL = new Set<string>(["asset", "expense", "contra_revenue"]);

export function isValidAccountType(type: unknown): type is AccountType {
  return typeof type === "string" && (ACCOUNT_TYPES as readonly string[]).includes(type);
}

/** true when the account's balance grows with debits. */
export function isDebitNormal(type: string | null | undefined): boolean {
  return DEBIT_NORMAL.has(String(type || ""));
}

export function normalBalanceSide(type: string | null | undefined): "Dr" | "Cr" {
  return isDebitNormal(type) ? "Dr" : "Cr";
}

/** Signed balance of one line in the account's own normal direction. */
export function signedLineBalance(type: string | null | undefined, debit: number, credit: number): number {
  return isDebitNormal(type) ? debit - credit : credit - debit;
}

/** The statement class an account type belongs to (contra types fall under their parent class). */
export function accountClass(type: string | null | undefined): "asset" | "liability" | "equity" | "revenue" | "expense" | "other" {
  switch (String(type || "")) {
    case "asset":
    case "contra_asset":
      return "asset";
    case "liability":
      return "liability";
    case "equity":
      return "equity";
    case "revenue":
    case "contra_revenue":
      return "revenue";
    case "expense":
    case "contra_expense":
      return "expense";
    default:
      return "other";
  }
}

/** Contra types carry the opposite sign of their class when totals are added up. */
export function isContraType(type: string | null | undefined): boolean {
  const t = String(type || "");
  return t === "contra_asset" || t === "contra_revenue" || t === "contra_expense";
}

/** Contribution of an account's (normal-direction) balance to its class total. */
export function classContribution(type: string | null | undefined, balance: number): number {
  return isContraType(type) ? -balance : balance;
}

/** A level-3 group of type `groupType` may hold posting accounts of type `type`. */
export function typeFitsGroup(type: string, groupType: string): boolean {
  return type === groupType || accountClass(type) === accountClass(groupType);
}

export const PROFIT_AND_LOSS_TYPES = ["revenue", "contra_revenue", "expense", "contra_expense"] as const;
