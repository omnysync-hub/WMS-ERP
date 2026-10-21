/** Pure supplier-bill discount math shared by ProcurementService (server) and the bill UI (client). */
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Supplier bill discount math (pure, exported for UI parity / tests).
 * gross line = qty x price; line discount = gross x line% ; net line = gross - line discount
 * bill discount applies to the sum of net lines (percent 0-100, or fixed amount <= that sum)
 * subtotal (pre-tax, net) = net lines - bill discount; total = subtotal + tax
 */
export function computeSupplierBillTotals(input: {
  items: { billedQuantity: number; billedUnitPrice: number; discountPercent?: number }[];
  discountType?: string | null;
  discountValue?: number | null;
  taxAmount?: number | null;
}) {
  let grossAmount = 0;
  let lineDiscountTotal = 0;
  const lines = input.items.map((it, idx) => {
    const qty = Number(it.billedQuantity) || 0;
    const price = Number(it.billedUnitPrice) || 0;
    if (qty < 0 || price < 0) throw new Error(`Line ${idx + 1}: quantity and unit price cannot be negative.`);
    const pct = Number(it.discountPercent) || 0;
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      throw new Error(`Line ${idx + 1}: discount percent must be between 0 and 100.`);
    }
    const gross = round2(qty * price);
    const disc = round2((gross * pct) / 100);
    grossAmount += gross;
    lineDiscountTotal += disc;
    return { gross, discountPercent: pct, discountAmount: disc, net: round2(gross - disc) };
  });
  grossAmount = round2(grossAmount);
  lineDiscountTotal = round2(lineDiscountTotal);
  const netLines = round2(grossAmount - lineDiscountTotal);

  const type = input.discountType === "percent" || input.discountType === "amount" ? input.discountType : null;
  const value = Number(input.discountValue) || 0;
  if (value < 0) throw new Error("Bill discount cannot be negative.");
  if (value > 0 && !type) throw new Error('Bill discount type must be "percent" or "amount".');
  let billDiscount = 0;
  if (type === "percent") {
    if (value > 100) throw new Error("Bill discount percent must be between 0 and 100.");
    billDiscount = round2((netLines * value) / 100);
  } else if (type === "amount") {
    if (value > netLines + 0.005) {
      throw new Error(`Bill discount (PKR ${value}) cannot exceed the bill subtotal (PKR ${netLines}).`);
    }
    billDiscount = round2(value);
  }
  const taxAmount = round2(Number(input.taxAmount) || 0);
  if (taxAmount < 0) throw new Error("Tax amount cannot be negative.");
  const subtotal = round2(netLines - billDiscount);
  const totalAmount = round2(subtotal + taxAmount);
  return {
    lines,
    grossAmount,
    lineDiscountTotal,
    netLines,
    discountType: billDiscount > 0 || value > 0 ? type : null,
    discountValue: type ? value : 0,
    billDiscount,
    subtotal,
    taxAmount,
    totalAmount,
  };
}
