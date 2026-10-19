export type TaxRule = {
  id: string;
  name: string;
  code: string;
  type: "sales_tax" | "services_tax" | "withholding" | "other";
  rate: number;
  appliesTo: "sales" | "purchases" | "both";
  inclusive: boolean;
  isDefault: boolean;
  active: boolean;
  effectiveFrom?: string | null;
  accountRole?: string | null;
};

export type PaymentMethodConfig = {
  id: string;
  name: string;
  code: string;
  kind: "cash" | "bank" | "card" | "cheque" | "digital" | "credit" | "split";
  requiresReference: boolean;
  financialAccountId?: string;
  active: boolean;
};

export type ExpenseCategoryConfig = {
  id: string;
  name: string;
  code: string;
  accountId: string;
  active: boolean;
};

export const parseConfigArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

export const normalizeAgingBuckets = (value: unknown): [number, number, number] => {
  const numbers = Array.isArray(value)
    ? value.map(Number).filter((item) => Number.isInteger(item) && item > 0)
    : [];
  if (numbers.length !== 3 || !(numbers[0] < numbers[1] && numbers[1] < numbers[2])) {
    return [30, 60, 90];
  }
  return [numbers[0], numbers[1], numbers[2]];
};

export const accountingPolicyReadiness = (settings: {
  invoicePrefix?: string | null;
  invoiceNextNumber?: number | null;
  invoiceNumberPadding?: number | null;
  taxRules?: unknown;
  paymentMethods?: unknown;
  agingBuckets?: unknown;
  expenseCategories?: unknown;
  accountingPoliciesCompleted?: boolean | null;
}) => {
  const taxRules = parseConfigArray<TaxRule>(settings.taxRules).filter((item) => item.active);
  const paymentMethods = parseConfigArray<PaymentMethodConfig>(settings.paymentMethods).filter((item) => item.active);
  const expenseCategories = parseConfigArray<ExpenseCategoryConfig>(settings.expenseCategories).filter((item) => item.active);
  const agingBuckets = normalizeAgingBuckets(settings.agingBuckets);
  const prefix = String(settings.invoicePrefix || "").trim();
  const numberingReady = /^[A-Z0-9-]{2,12}$/.test(prefix) && Number(settings.invoiceNextNumber) > 0 && Number(settings.invoiceNumberPadding) >= 3;

  return {
    complete:
      Boolean(settings.accountingPoliciesCompleted) &&
      numberingReady &&
      taxRules.length > 0 &&
      paymentMethods.length > 0 &&
      expenseCategories.length > 0,
    numberingReady,
    taxRules,
    paymentMethods,
    expenseCategories,
    agingBuckets,
  };
};
