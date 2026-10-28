import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pktParts } from "@/lib/pktTime";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Sequential code generator (PREFIX-YYYY-0001).
 *
 * Race safety: when called with a transaction client, it takes a Postgres transaction-level
 * advisory lock for this prefix, so two saves running at the same moment are serialised and
 * cannot pick the same number (the lock is held until that transaction commits). The unique
 * index on the field is the final guard. Callers outside a transaction should use
 * withSequenceLock() (or retry on P2002).
 */
async function generateCode(
  prefix: string,
  model: string,
  field: string,
  padLength: number = 4,
  db: Db = prisma
): Promise<string> {
  const delegate: any = (db as any)[model];
  const currentYear = pktParts().year; // Pakistan calendar year (server clock is UTC)
  const yearPrefix = `${prefix}-${currentYear}-`;

  if (db !== prisma) {
    await (db as any).$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `seq:${prefix}`);
  }

  // Highest number already used this year (not "latest created", which can be out of order).
  const rows: any[] = await delegate.findMany({
    where: { [field]: { startsWith: yearPrefix } },
    select: { [field]: true },
  });
  let seq = 1;
  const re = new RegExp(`^${prefix.replace(/[-]/g, "\\-")}-\\d+-(\\d+)$`);
  for (const r of rows) {
    const m = String(r[field] || "").match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n >= seq) seq = n + 1;
    }
  }

  let code = `${yearPrefix}${String(seq).padStart(padLength, "0")}`;
  while (await delegate.findFirst({ where: { [field]: code }, select: { id: true } })) {
    seq++;
    code = `${yearPrefix}${String(seq).padStart(padLength, "0")}`;
  }
  return code;
}

/** True when a Prisma error is a unique-constraint clash. */
export function isUniqueViolation(err: any): boolean {
  return err?.code === "P2002";
}

export async function generateJobNumber(): Promise<string> {
  return generateCode("JOB", "job", "jobNumber", 4);
}

export async function generatePoNumber(): Promise<string> {
  return generateCode("PO", "purchaseOrder", "poNumber", 4);
}

export async function generatePrNumber(): Promise<string> {
  return generateCode("PR", "purchaseRequisition", "prNumber", 4);
}

/** Purchase requisitions raised from a project BOQ keep their own PR-PRJ- series. */
export async function generateProjectPrNumber(): Promise<string> {
  return generateCode("PR-PRJ", "purchaseRequisition", "prNumber", 4);
}

export async function generateRfqNumber(): Promise<string> {
  return generateCode("RFQ", "requestForQuotation", "rfqNumber", 4);
}

export async function generateGrnNumber(db: Db = prisma): Promise<string> {
  return generateCode("GRN", "goodsReceipt", "grnNumber", 4, db);
}

/** Supplier bill reference (stored in the unique SupplierInvoice.referenceNumber field). */
export async function generateSupplierInvoiceNumber(db: Db = prisma): Promise<string> {
  return generateCode("VINV", "supplierInvoice", "referenceNumber", 4, db);
}

export async function generateSupplierPaymentNumber(db: Db = prisma): Promise<string> {
  return generateCode("SPAY", "supplierPayment", "paymentNumber", 4, db);
}

export async function generateProjectCode(): Promise<string> {
  return generateCode("PRJ", "project", "projectCode", 4);
}
