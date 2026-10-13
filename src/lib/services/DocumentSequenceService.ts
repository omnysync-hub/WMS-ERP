type SequenceClient = {
  companySettings: {
    findFirst: (args?: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  invoice?: {
    findMany?: (args?: any) => Promise<any>;
    findFirst?: (args?: any) => Promise<any>;
    findUnique?: (args?: any) => Promise<any>;
  };
};

export class DocumentSequenceService {
  static async nextInvoiceNumber(db: SequenceClient, issuedAt: Date = new Date()): Promise<string> {
    const current = await db.companySettings.findFirst();
    if (!current) throw new Error("Company accounting setup is incomplete: invoice numbering is not configured.");

    const prefix = String(current.invoicePrefix || "INV").trim().toUpperCase();
    const padding = Math.min(10, Math.max(3, Number(current.invoiceNumberPadding) || 4));
    const year = issuedAt.getFullYear();

    let seq = Math.max(1, Number(current.invoiceNextNumber) || 1);

    if (db.invoice?.findMany) {
      const existing = await db.invoice.findMany({
        where: { invoiceNumber: { startsWith: `${prefix}-${year}-` } },
        select: { invoiceNumber: true },
      });
      const usedNumbers = new Set((existing || []).map((e: any) => e.invoiceNumber));
      let candidate = `${prefix}-${year}-${String(seq).padStart(padding, "0")}`;
      while (usedNumbers.has(candidate)) {
        seq++;
        candidate = `${prefix}-${year}-${String(seq).padStart(padding, "0")}`;
      }
      await db.companySettings.update({
        where: { id: current.id },
        data: { invoiceNextNumber: seq + 1 },
      });
      return candidate;
    }

    const updated = await db.companySettings.update({
      where: { id: current.id },
      data: { invoiceNextNumber: { increment: 1 } },
    });
    const sequence = Math.max(1, Number(updated.invoiceNextNumber) - 1);
    return `${prefix}-${year}-${String(sequence).padStart(padding, "0")}`;
  }
}
