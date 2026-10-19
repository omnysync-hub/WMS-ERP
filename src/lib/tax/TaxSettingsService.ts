import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccountMappingService } from "@/lib/services/AccountMappingService";
import {
  computeTax,
  findRate,
  jobTaxRate,
  normalizeTaxPolicy,
  normalizeTaxRates,
  type TaxBreakdown,
  type TaxPolicy,
  type TaxRateConfig,
} from "./taxConfig";

type Db = PrismaClient | Prisma.TransactionClient;

export type JobTaxResult = TaxBreakdown & {
  rate: TaxRateConfig | null;
  /** true when this came from an existing invoice snapshot (never recalculated with new rules). */
  fromInvoice: boolean;
  rounding: TaxPolicy["rounding"];
};

/** Server-side tax settings and calculations. */
export class TaxSettingsService {
  static async load(db: Db = prisma): Promise<{ rates: TaxRateConfig[]; policy: TaxPolicy }> {
    const settings = await (db as PrismaClient).companySettings.findFirst({ select: { taxRules: true, taxPolicy: true } });
    return { rates: normalizeTaxRates(settings?.taxRules), policy: normalizeTaxPolicy(settings?.taxPolicy) };
  }

  /** GL account for a tax rate's role (fails loudly if the role is not mapped). */
  static async accountFor(rate: Pick<TaxRateConfig, "accountRole">, fallbackRole: string, db: Db = prisma) {
    return AccountMappingService.resolveAccount({ transactionType: rate.accountRole || fallbackRole, prismaClient: db });
  }

  /**
   * Tax for a job's current lines. If the job already has an invoice, its snapshot is reused, so
   * invoices raised before tax support (taxApplied=false) stay without tax on re-finalize.
   */
  static async forJob(
    job: {
      id: string;
      jobType?: string | null;
      isFoc?: boolean;
      careOfPartyId?: string | null;
      customerId?: string | null;
      customer?: { taxExempt?: boolean | null } | null;
    },
    gross: number,
    discount: number,
    db: Db = prisma
  ): Promise<JobTaxResult> {
    const { rates, policy } = await this.load(db);
    const invoice = await (db as PrismaClient).invoice.findFirst({ where: { jobId: job.id }, orderBy: { createdAt: "desc" } });
    if (invoice) {
      const rateCfg = invoice.taxApplied && invoice.taxCode ? findRate(rates, invoice.taxCode) : null;
      const b = computeTax({
        gross,
        discount,
        ratePercent: invoice.taxApplied ? invoice.taxRate : 0,
        inclusive: invoice.taxApplied ? invoice.taxInclusive : false,
        applyAfterDiscount: policy.jobs.applyAfterDiscount,
        rounding: policy.rounding,
      });
      return {
        ...b,
        rate: rateCfg || (invoice.taxApplied && invoice.taxRate > 0
          ? ({ id: "snapshot", name: invoice.taxName || invoice.taxCode || "Tax", code: invoice.taxCode || "TAX", type: "sales_tax", rate: invoice.taxRate, appliesTo: "sales", inclusive: invoice.taxInclusive, isDefault: false, active: true, accountRole: "sales_tax_payable" } as TaxRateConfig)
          : null),
        fromInvoice: true,
        rounding: policy.rounding,
      };
    }
    let exempt = job.customer?.taxExempt;
    if (exempt === undefined && job.customerId) {
      const c = await (db as PrismaClient).customer.findUnique({ where: { id: job.customerId }, select: { taxExempt: true } });
      exempt = c?.taxExempt;
    }
    const rate = jobTaxRate(policy, rates, {
      jobType: job.jobType,
      isFoc: job.isFoc,
      careOfPartyId: job.careOfPartyId,
      customerTaxExempt: Boolean(exempt),
    });
    const b = computeTax({
      gross,
      discount,
      ratePercent: rate?.rate || 0,
      inclusive: policy.jobs.pricesIncludeTax,
      applyAfterDiscount: policy.jobs.applyAfterDiscount,
      rounding: policy.rounding,
    });
    return { ...b, rate, fromInvoice: false, rounding: policy.rounding };
  }

  /** Billing-summary helper for apps: the rule used so a client can recompute with edited lines. */
  static describe(result: JobTaxResult) {
    return {
      enabled: Boolean(result.rate) && result.ratePercent > 0,
      code: result.rate?.code ?? null,
      name: result.rate?.name ?? null,
      ratePercent: result.ratePercent,
      inclusive: result.inclusive,
      applyAfterDiscount: result.applyAfterDiscount,
      rounding: result.rounding,
      taxAmount: result.tax,
      total: result.total,
    };
  }
}
