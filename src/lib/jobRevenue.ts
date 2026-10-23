/**
 * Which revenue account a job invoice credits (new chart of accounts):
 *   installation jobs            -> job_revenue_sales  (4000 Service Revenue - Installation)
 *   repair / service / complaint -> job_revenue_repair (4001 Service Revenue - Repair & Maintenance)
 *   goods and products sold      -> job_revenue_goods  (4010 Goods Revenue, incl. market-purchased)
 * Job types are free text, so the type is matched by meaning.
 */
export type JobRevenueRole = "job_revenue_sales" | "job_revenue_repair";

const INSTALLATION_WORDS = /install|commission|erect|piping|new\s*unit|setup|set-up/i;

export function jobRevenueRole(jobType?: string | null): JobRevenueRole {
  const t = (jobType || "").trim();
  if (!t) return "job_revenue_sales";
  return INSTALLATION_WORDS.test(t) ? "job_revenue_sales" : "job_revenue_repair";
}

/**
 * A job line counts as "goods sold to the customer" when it is stock issued by the storekeeper
 * or is tagged as goods / market purchase. Everything else on the invoice is service.
 */
const GOODS_MARKERS = /\[\s*(issued by storekeeper|goods|market[\s-]*purchase[d]?|product[s]?)\s*\]/i;

export function isGoodsLine(description?: string | null): boolean {
  return GOODS_MARKERS.test(description || "");
}

/** Share (0..1) of the job's billable value that is goods, from the actual (else planned) quantities. */
export function goodsShareOfItems(
  items: { description?: string | null; quantityActual: number | null; quantityPlanned: number; unitRate: number }[]
): number {
  let total = 0;
  let goods = 0;
  for (const it of items) {
    const value = (it.quantityActual ?? it.quantityPlanned) * it.unitRate;
    if (!(value > 0)) continue;
    total += value;
    if (isGoodsLine(it.description)) goods += value;
  }
  return total > 0 ? goods / total : 0;
}
