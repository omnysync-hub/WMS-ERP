import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccountMappingService } from "@/lib/services/AccountMappingService";
import { goodsShareOfItems } from "@/lib/jobRevenue";
import {
  computeTax,
  findRate,
  jobTaxRate,
  normalizeTaxPolicy,
  normalizeTaxRates,
  type TaxBreakdown,
  type TaxComponent,
  computeSplitTax,
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
    // Goods part of the invoice (store-issued / market-purchased lines), same rule as the revenue split.
    const goodsGrossOf = async () => {
      const items = await (db as PrismaClient).jobItem.findMany({ where: { jobId: job.id } });
      return Math.round(gross * goodsShareOfItems(items) * 100) / 100;
    };
    const snapshotComponents = Array.isArray(invoice?.taxBreakdown) ? (invoice!.taxBreakdown as unknown as TaxComponent[]) : null;
    if (invoice && invoice.taxApplied && snapshotComponents && snapshotComponents.length > 0) {
      // Split invoice: re-use the rates it was raised with, on the current services / goods values.
      const asRate = (c?: TaxComponent): TaxRateConfig | null =>
        c
          ? ({ id: `snapshot-${c.part}`, name: c.name, code: c.code, type: c.part === "goods" ? "sales_tax" : "services_tax", rate: c.ratePercent, appliesTo: "sales", inclusive: invoice.taxInclusive, isDefault: false, active: true, accountRole: c.accountRole } as TaxRateConfig)
          : null;
      const goodsGross = await goodsGrossOf();
      const servicesRate = asRate(snapshotComponents.find((c) => c.part === "services"));
      const goodsRate = asRate(snapshotComponents.find((c) => c.part === "goods"));
      const b = computeSplitTax({
        servicesGross: gross - goodsGross,
        goodsGross,
        discount,
        services: { rate: servicesRate },
        goods: { rate: goodsRate },
        inclusive: invoice.taxInclusive,
        applyAfterDiscount: policy.jobs.applyAfterDiscount,
        rounding: policy.rounding,
      });
      return { ...b, rate: servicesRate || goodsRate, fromInvoice: true, rounding: policy.rounding };
    }
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
    // Separate goods rate (e.g. GST on parts) next to the job's services rate (e.g. PRA on labour).
    const goodsRate = rate && policy.jobs.goodsRateCode ? findRate(rates, policy.jobs.goodsRateCode) : null;
    if (rate && goodsRate) {
      const goodsGross = await goodsGrossOf();
      if (goodsGross > 0) {
        const b = computeSplitTax({
          servicesGross: gross - goodsGross,
          goodsGross,
          discount,
          services: { rate },
          goods: { rate: goodsRate },
          inclusive: policy.jobs.pricesIncludeTax,
          applyAfterDiscount: policy.jobs.applyAfterDiscount,
          rounding: policy.rounding,
        });
        return { ...b, rate, fromInvoice: false, rounding: policy.rounding };
      }
    }
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
      /** Present when services and goods are taxed at different rates. */
      components: result.components && result.components.length ? result.components : null,
    };
  }
}
