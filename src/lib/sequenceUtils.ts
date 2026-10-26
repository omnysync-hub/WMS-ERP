import { prisma } from "@/lib/prisma";

/**
 * Robust, collision-resistant sequential code generator.
 * Uses dynamic calendar year and checks for existing sequences to prevent P2002 duplicate crashes.
 */
async function generateCode(
  prefix: string,
  modelDelegate: any,
  field: string,
  padLength: number = 4
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const yearPrefix = `${prefix}-${currentYear}-`;

  const count = await modelDelegate.count();
  let seq = count + 1;

  const lastRecord = await modelDelegate.findFirst({
    where: { [field]: { startsWith: yearPrefix } },
    orderBy: { createdAt: "desc" },
    select: { [field]: true },
  });

  if (lastRecord && lastRecord[field]) {
    const match = String(lastRecord[field]).match(new RegExp(`${prefix}-\\d+-(\\d+)`));
    if (match) {
      const lastSeq = parseInt(match[1], 10);
      if (!isNaN(lastSeq) && lastSeq >= seq) {
        seq = lastSeq + 1;
      }
    }
  }

  let code = `${yearPrefix}${String(seq).padStart(padLength, "0")}`;
  let exists = await modelDelegate.findFirst({ where: { [field]: code }, select: { id: true } });
  while (exists) {
    seq++;
    code = `${yearPrefix}${String(seq).padStart(padLength, "0")}`;
    exists = await modelDelegate.findFirst({ where: { [field]: code }, select: { id: true } });
  }

  return code;
}

export async function generateJobNumber(): Promise<string> {
  return generateCode("JOB", prisma.job, "jobNumber", 4);
}

export async function generatePoNumber(): Promise<string> {
  return generateCode("PO", prisma.purchaseOrder, "poNumber", 4);
}

export async function generatePrNumber(): Promise<string> {
  return generateCode("PR", prisma.purchaseRequisition, "prNumber", 4);
}

export async function generateRfqNumber(): Promise<string> {
  return generateCode("RFQ", prisma.requestForQuotation, "rfqNumber", 4);
}

export async function generateGrnNumber(): Promise<string> {
  return generateCode("GRN", prisma.goodsReceipt, "grnNumber", 4);
}

export async function generateSupplierInvoiceNumber(): Promise<string> {
  return generateCode("VINV", prisma.supplierInvoice, "invoiceNumber", 4);
}

export async function generateSupplierPaymentNumber(): Promise<string> {
  return generateCode("PMT", prisma.supplierPayment, "paymentNumber", 4);
}

export async function generateProjectCode(): Promise<string> {
  return generateCode("PRJ", prisma.project, "projectCode", 4);
}
