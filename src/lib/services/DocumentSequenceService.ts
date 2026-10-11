type SequenceClient = {
  companySettings: {
    findFirst: (args?: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
};

export class DocumentSequenceService {
  static async nextInvoiceNumber(db: SequenceClient, issuedAt: Date = new Date()): Promise<string> {
    const current = await db.companySettings.findFirst();
    if (!current) throw new Error("Company accounting setup is incomplete: invoice numbering is not configured.");

    const updated = await db.companySettings.update({
      where: { id: current.id },
      data: { invoiceNextNumber: { increment: 1 } },
    });
    const sequence = Math.max(1, Number(updated.invoiceNextNumber) - 1);
    const prefix = String(updated.invoicePrefix || "INV").trim().toUpperCase();
    const padding = Math.min(10, Math.max(3, Number(updated.invoiceNumberPadding) || 4));
    return `${prefix}-${issuedAt.getFullYear()}-${String(sequence).padStart(padding, "0")}`;
  }
}
