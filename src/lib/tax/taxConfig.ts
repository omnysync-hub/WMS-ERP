/**
 * Tax settings shared by the ERP server, the ERP browser pages and (copied) the mobile app.
 * Pure functions only — no database access here.
 *
 * Tax RATES live in CompanySettings.taxRules (the same list the setup wizard edits).
 * Tax RULES ("what should happen") live in CompanySettings.taxPolicy.
 * Defaults keep the old behaviour: no tax on jobs, projects or bills until switched on.
 */

export type TaxKind = "sales_tax" | "services_tax" | "withholding" | "other";
export type TaxAccountRole = "sales_tax_payable" | "input_tax_receivable" | "vendor_payment_wht" | "wht_receivable";

export type TaxRateConfig = {
  id: string;
  name: string;
  code: string;
  /** sales_tax = GST on goods (FBR); services_tax = provincial PST/SST/PRA; withholding = WHT. */
  type: TaxKind;
  rate: number;
  appliesTo: "sales" | "purchases" | "both";
  /** Legacy flag from the setup wizard; price inclusiveness is decided per module in the policy. */
  inclusive: boolean;
  isDefault: boolean;
  active: boolean;
  /** YYYY-MM-DD; the rate is used for documents dated on/after this day. */
  effectiveFrom?: string | null;
  /** Account role the tax posts to (mapped to a GL account in Account Mapping). */
  accountRole?: TaxAccountRole | null;
};

export type RoundingMode = "nearest" | "up" | "down";

export type ModuleTaxPolicy = {
  enabled: boolean;
  /** Code of the tax rate to charge. */
  rateCode: string | null;
  pricesIncludeTax: boolean;
  /** true: tax on (price - discount). false: tax on the full price before discount. */
  applyAfterDiscount: boolean;
};

export type TaxPolicy = {
  jobs: ModuleTaxPolicy & {
    /** Per job type override: a rate code, or "exempt". Missing = use rateCode. */
    byJobType: Record<string, string>;
    /** Charge tax on jobs that came through a care-of company (normal billing to the customer). */
    taxCareOfJobs: boolean;
    /** FOC jobs: treat the referring company's payment as tax-inclusive and split out the tax. */
    taxFocPayments: boolean;
  };
  pos: {
    /** off = never; cashier = cashier ticks "apply tax" per sale (old behaviour); always = every sale. */
    mode: "off" | "cashier" | "always";
    rateCode: string | null;
    pricesIncludeTax: boolean;
    applyAfterDiscount: boolean;
  };
  procurement: {
    /** Record supplier sales tax as recoverable input tax (Dr input tax) instead of part of cost. */
    recordInputTax: boolean;
    /** Work out the bill's tax from the rate instead of typing it. */
    autoCalculate: boolean;
    rateCode: string | null;
    applyAfterDiscount: boolean;
  };
  projects: ModuleTaxPolicy;
  wht: {
    /** Deduct WHT when paying suppliers (uses the supplier's WHT %, else the default rate). */
    deductOnSupplierPayments: boolean;
    defaultRateCode: string | null;
    /** Allow recording WHT that customers deduct from what they pay us (Dr WHT receivable). */
    allowOnCustomerReceipts: boolean;
  };
  rounding: { mode: RoundingMode; decimals: 0 | 2 };
};

export const DEFAULT_TAX_POLICY: TaxPolicy = {
  jobs: {
    enabled: false,
    rateCode: null,
    pricesIncludeTax: false,
    applyAfterDiscount: true,
    byJobType: {},
    taxCareOfJobs: true,
    taxFocPayments: false,
  },
  pos: { mode: "cashier", rateCode: null, pricesIncludeTax: false, applyAfterDiscount: true },
  procurement: { recordInputTax: false, autoCalculate: false, rateCode: null, applyAfterDiscount: true },
  projects: { enabled: false, rateCode: null, pricesIncludeTax: false, applyAfterDiscount: true },
  wht: { deductOnSupplierPayments: true, defaultRateCode: null, allowOnCustomerReceipts: false },
  rounding: { mode: "nearest", decimals: 2 },
};

const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const code = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : null);

export function normalizeTaxPolicy(input: unknown): TaxPolicy {
  const p: any = input && typeof input === "object" ? input : {};
  const d = DEFAULT_TAX_POLICY;
  const mod = (src: any, def: ModuleTaxPolicy): ModuleTaxPolicy => ({
    enabled: bool(src?.enabled, def.enabled),
    rateCode: code(src?.rateCode),
    pricesIncludeTax: bool(src?.pricesIncludeTax, def.pricesIncludeTax),
    applyAfterDiscount: bool(src?.applyAfterDiscount, def.applyAfterDiscount),
  });
  const byJobType: Record<string, string> = {};
  if (p.jobs?.byJobType && typeof p.jobs.byJobType === "object") {
    for (const [k, v] of Object.entries(p.jobs.byJobType)) {
      const c = typeof v === "string" ? v.trim() : "";
      if (k.trim() && c) byJobType[k.trim()] = c.toLowerCase() === "exempt" ? "exempt" : c.toUpperCase();
    }
  }
  const posMode = ["off", "cashier", "always"].includes(p.pos?.mode) ? p.pos.mode : d.pos.mode;
  const roundingMode: RoundingMode = ["nearest", "up", "down"].includes(p.rounding?.mode) ? p.rounding.mode : "nearest";
  return {
    jobs: {
      ...mod(p.jobs, d.jobs),
      byJobType,
      taxCareOfJobs: bool(p.jobs?.taxCareOfJobs, d.jobs.taxCareOfJobs),
      taxFocPayments: bool(p.jobs?.taxFocPayments, d.jobs.taxFocPayments),
    },
    pos: {
      mode: posMode,
      rateCode: code(p.pos?.rateCode),
      pricesIncludeTax: bool(p.pos?.pricesIncludeTax, d.pos.pricesIncludeTax),
      applyAfterDiscount: bool(p.pos?.applyAfterDiscount, d.pos.applyAfterDiscount),
    },
    procurement: {
      recordInputTax: bool(p.procurement?.recordInputTax, d.procurement.recordInputTax),
      autoCalculate: bool(p.procurement?.autoCalculate, d.procurement.autoCalculate),
      rateCode: code(p.procurement?.rateCode),
      applyAfterDiscount: bool(p.procurement?.applyAfterDiscount, d.procurement.applyAfterDiscount),
    },
    projects: mod(p.projects, d.projects),
    wht: {
      deductOnSupplierPayments: bool(p.wht?.deductOnSupplierPayments, d.wht.deductOnSupplierPayments),
      defaultRateCode: code(p.wht?.defaultRateCode),
      allowOnCustomerReceipts: bool(p.wht?.allowOnCustomerReceipts, d.wht.allowOnCustomerReceipts),
    },
    rounding: { mode: roundingMode, decimals: Number(p.rounding?.decimals) === 0 ? 0 : 2 },
  };
}

export const TAX_KINDS: { value: TaxKind; label: string; defaultRole: TaxAccountRole; appliesTo: TaxRateConfig["appliesTo"] }[] = [
  { value: "sales_tax", label: "Sales tax / GST (FBR)", defaultRole: "sales_tax_payable", appliesTo: "both" },
  { value: "services_tax", label: "Services tax (PRA / SRB / KPRA / BRA)", defaultRole: "sales_tax_payable", appliesTo: "sales" },
  { value: "withholding", label: "Withholding tax (WHT)", defaultRole: "vendor_payment_wht", appliesTo: "purchases" },
  { value: "other", label: "Other", defaultRole: "sales_tax_payable", appliesTo: "both" },
];

export const TAX_ACCOUNT_ROLES: { value: TaxAccountRole; label: string; defaultCode: string }[] = [
  { value: "sales_tax_payable", label: "Sales tax payable (output tax)", defaultCode: "2210" },
  { value: "input_tax_receivable", label: "Input tax receivable (claimable)", defaultCode: "1160" },
  { value: "vendor_payment_wht", label: "WHT payable (deducted from suppliers)", defaultCode: "2200" },
  { value: "wht_receivable", label: "WHT receivable (deducted by customers)", defaultCode: "1170" },
];

export function normalizeTaxRates(input: unknown): TaxRateConfig[] {
  const rows = Array.isArray(input) ? input : [];
  return rows
    .filter((r: any) => r && typeof r === "object")
    .map((r: any, i: number): TaxRateConfig => {
      const type: TaxKind = ["sales_tax", "services_tax", "withholding", "other"].includes(r.type) ? r.type : "other";
      const role = TAX_ACCOUNT_ROLES.some((x) => x.value === r.accountRole)
        ? (r.accountRole as TaxAccountRole)
        : TAX_KINDS.find((k) => k.value === type)!.defaultRole;
      return {
        id: String(r.id || `tax-${i + 1}`),
        name: String(r.name || "").trim(),
        code: String(r.code || "").trim().toUpperCase(),
        type,
        rate: Math.max(0, Math.min(100, Number(r.rate) || 0)),
        appliesTo: ["sales", "purchases", "both"].includes(r.appliesTo) ? r.appliesTo : "both",
        inclusive: Boolean(r.inclusive),
        isDefault: Boolean(r.isDefault),
        active: r.active !== false,
        effectiveFrom: typeof r.effectiveFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.effectiveFrom) ? r.effectiveFrom : null,
        accountRole: role,
      };
    });
}

/** Active rate with this code that is in effect on `date` (latest effective-from wins). */
export function findRate(rates: TaxRateConfig[], rateCode: string | null | undefined, date: Date = new Date()): TaxRateConfig | null {
  if (!rateCode) return null;
  const day = date.toISOString().slice(0, 10);
  const matches = rates
    .filter((r) => r.active && r.code === rateCode.toUpperCase() && (!r.effectiveFrom || r.effectiveFrom <= day))
    .sort((a, b) => String(b.effectiveFrom || "").localeCompare(String(a.effectiveFrom || "")));
  return matches[0] || null;
}

export function roundTax(value: number, rounding: TaxPolicy["rounding"]): number {
  const f = rounding.decimals === 0 ? 1 : 100;
  const v = value * f;
  // tiny epsilon so 12.5000000001 style float noise does not round the wrong way
  const r = rounding.mode === "up" ? Math.ceil(v - 1e-9) : rounding.mode === "down" ? Math.floor(v + 1e-9) : Math.round(v);
  return r / f;
}

export type TaxBreakdown = {
  /** Price total before discount (as entered). */
  gross: number;
  discount: number;
  /** Amount the tax is worked out on. */
  taxableAmount: number;
  ratePercent: number;
  tax: number;
  /** What the customer pays. */
  total: number;
  /** Revenue to credit (gross price excluding tax; the discount is debited separately). */
  revenueGross: number;
  inclusive: boolean;
  applyAfterDiscount: boolean;
};

/**
 * One formula for every module.
 * Exclusive: total = gross - discount + tax.        Revenue (gross) = gross.
 * Inclusive: total = gross - discount (tax inside). Revenue (gross) = gross - tax.
 * Always balanced: total + discount = revenueGross + tax.
 */
export function computeTax(params: {
  gross: number;
  discount?: number;
  ratePercent: number;
  inclusive: boolean;
  applyAfterDiscount: boolean;
  rounding: TaxPolicy["rounding"];
}): TaxBreakdown {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const gross = r2(Math.max(0, params.gross));
  const discount = r2(Math.min(Math.max(0, params.discount || 0), gross));
  const rate = Math.max(0, Number(params.ratePercent) || 0);
  const base = params.applyAfterDiscount ? gross - discount : gross;
  let tax = 0;
  if (rate > 0 && base > 0) {
    tax = params.inclusive ? roundTax((base * rate) / (100 + rate), params.rounding) : roundTax((base * rate) / 100, params.rounding);
  }
  tax = r2(tax);
  const total = params.inclusive ? r2(gross - discount) : r2(gross - discount + tax);
  const revenueGross = params.inclusive ? r2(gross - tax) : gross;
  return {
    gross,
    discount,
    taxableAmount: r2(base),
    ratePercent: rate,
    tax,
    total,
    revenueGross,
    inclusive: params.inclusive,
    applyAfterDiscount: params.applyAfterDiscount,
  };
}

/** Decide which rate (if any) applies to a job. Returns null when no tax applies. */
export function jobTaxRate(
  policy: TaxPolicy,
  rates: TaxRateConfig[],
  job: { jobType?: string | null; isFoc?: boolean; careOfPartyId?: string | null; customerTaxExempt?: boolean },
  date: Date = new Date()
): TaxRateConfig | null {
  if (!policy.jobs.enabled || job.isFoc || job.customerTaxExempt) return null;
  if (job.careOfPartyId && !policy.jobs.taxCareOfJobs) return null;
  const override = job.jobType ? policy.jobs.byJobType[job.jobType] : undefined;
  if (override === "exempt") return null;
  return findRate(rates, override || policy.jobs.rateCode, date);
}
