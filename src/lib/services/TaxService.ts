import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";
import { SubLedgerService } from "./SubLedgerService";

export interface PostVendorPaymentParams {
  vendorId: string;
  grossAmount: number;
  disbursingAccountCode?: string; // e.g. "1000" Cash or "1010" Meezan Bank
  paymentDate?: Date;
  cprNumber?: string; // FBR CPR (Computerized Payment Receipt)
  memo?: string;
  postedBy?: string;
}

export class TaxService {
  /**
   * Calculate Withholding Tax (WHT) under customizable vendor rate.
   * As confirmed by user: fully custom rate configured per vendor (e.g. 8%, 11%, 5%, 0% exempt).
   */
  static calculateWht(grossAmount: number, whtRate: number, isExempt: boolean = false) {
    if (isExempt || whtRate <= 0) {
      return {
        grossAmount,
        whtRate: 0,
        whtAmount: 0,
        netPayable: grossAmount,
      };
    }

    const whtAmount = Math.round(((grossAmount * whtRate) / 100) * 100) / 100;
    const netPayable = Math.round((grossAmount - whtAmount) * 100) / 100;

    return {
      grossAmount,
      whtRate,
      whtAmount,
      netPayable,
    };
  }

  /**
   * Process a Vendor Payment with Automatic WHT Withholding Posting.
   * Standard GAAP / FBR Double-Entry Posting:
   * Dr 2000 Accounts Payable (Full gross bill amount)
   * Cr 2200 Withholding Tax (WHT) Payable (FBR) (Tax withheld)
   * Cr 1000/1010 Cash or Bank Account (Net payment disbursed)
   * Also updates Vendor sub-ledger and logs CPR number.
   */
  static async postVendorPaymentWithWht(params: PostVendorPaymentParams) {
    const {
      vendorId,
      grossAmount,
      disbursingAccountCode = "1000",
      paymentDate = new Date(),
      cprNumber,
      memo,
      postedBy = "Accountant",
    } = params;

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (!vendor) throw new Error("Vendor not found");

    const taxCalc = this.calculateWht(grossAmount, vendor.whtRate, vendor.whtExempt);

    // 1. Get Accounts
    const apAccount = await AccountsPostingService.getAccountByCode("2000"); // Accounts Payable
    const whtAccount = await AccountsPostingService.getAccountByCode("2200"); // WHT Payable
    const disbursingAccount = await AccountsPostingService.getAccountByCode(disbursingAccountCode);

    // 2. Prepare Balanced Journal Lines
    const lines = [];

    // Dr AP (Full gross amount)
    lines.push({
      accountId: apAccount.id,
      debit: taxCalc.grossAmount,
      credit: 0,
    });

    // Cr WHT Payable (if any withheld)
    if (taxCalc.whtAmount > 0) {
      lines.push({
        accountId: whtAccount.id,
        debit: 0,
        credit: taxCalc.whtAmount,
      });
    }

    // Cr Cash/Bank (Net amount paid to vendor)
    if (taxCalc.netPayable > 0) {
      lines.push({
        accountId: disbursingAccount.id,
        debit: 0,
        credit: taxCalc.netPayable,
      });
    }

    const docNumber = `PAY-${Date.now().toString().slice(-6)}`;

    // 3. Post to General Ledger Spine
    const journal = await AccountsPostingService.post({
      date: paymentDate,
      memo: memo || `Payment to ${vendor.name}: Net PKR ${taxCalc.netPayable} (WHT PKR ${taxCalc.whtAmount} withheld @ ${vendor.whtRate}%)`,
      refType: "vendor_payment_wht",
      refId: vendor.id,
      postedBy,
      lines,
    });

    // 4. Record Vendor Sub-Ledger Entry
    const subledger = await SubLedgerService.recordVendorEntry({
      vendorId: vendor.id,
      entryType: "payment",
      documentNumber: docNumber,
      journalEntryId: journal.id,
      debit: taxCalc.grossAmount, // Reduces AP debt by full gross
      credit: 0,
      whtWithheld: taxCalc.whtAmount,
      cprNumber: cprNumber || undefined,
      notes: `Disbursed via ${disbursingAccount.name}. WHT withheld: PKR ${taxCalc.whtAmount}`,
    });

    return {
      success: true,
      journal,
      subledger,
      taxCalculation: taxCalc,
    };
  }

  static async getVendors() {
    return await prisma.vendor.findMany({
      include: {
        vendorLedgerEntries: {
          orderBy: { postingDate: "desc" },
          take: 5,
        },
      },
      orderBy: { name: "asc" },
    });
  }

  static async createVendor(data: any) {
    return await prisma.vendor.create({
      data: {
        name: data.name,
        contactPerson: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        addressText: data.addressText || null,
        ntnNumber: data.ntnNumber || null,
        strnNumber: data.strnNumber || null,
        whtRate: Number(data.whtRate) || 0,
        whtExempt: Boolean(data.whtExempt),
        paymentTermsDays: Number(data.paymentTermsDays) || 30,
      },
    });
  }
}
