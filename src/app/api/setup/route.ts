export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { FiscalPeriodService } from "@/lib/services/FiscalPeriodService";
import { FinancialReportingService } from "@/lib/services/FinancialReportingService";
import { STANDARD_COA_DEFINITIONS } from "@/lib/constants/chartOfAccountsHierarchy";

export async function GET(req: NextRequest) {
  try {
    // 1. Get or create CompanySettings singleton
    let settings = await prisma.companySettings.findFirst();
    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          legalName: "Enterprise Services (Pvt) Ltd",
          tradeName: "Enterprise Services",
          addressText: "Main Boulevard, Gulberg III, Lahore, Pakistan",
          phone: "042-111-0000",
          email: "finance@company.com",
          ntnNumber: "9482710-3",
          strnNumber: "3277876123456",
          baseCurrency: "PKR",
          fiscalYearStartMonth: 7, // July
          isSetupCompleted: false,
        },
      });
    }

    // 2. Check Fiscal Periods
    const currentYear = new Date().getFullYear();
    const periods = await prisma.fiscalPeriod.findMany({
      where: { fiscalYear: currentYear },
      orderBy: { periodNumber: "asc" },
    });

    // 3. Check Level 4 Accounts ready for opening balance entry
    for (const def of STANDARD_COA_DEFINITIONS) {
      if (!def.isGroup && def.level === 4) {
        await AccountsPostingService.getAccountByCode(def.code).catch(() => null);
      }
    }

    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });

    // 4. Check if Opening Balance has been posted
    const openingVoucher = await prisma.journalEntry.findFirst({
      where: { refType: "opening_balance" },
      include: { lines: { include: { account: true } } },
    });

    // 5. Counts for master data
    const [customerCount, vendorCount, productCount] = await Promise.all([
      prisma.customer.count(),
      prisma.vendor.count(),
      prisma.product.count(),
    ]);

    // 6. Trial Balance equilibrium check
    const tb = await FinancialReportingService.getTrialBalance();

    return NextResponse.json({
      success: true,
      settings,
      periodsCount: periods.length,
      periods,
      accounts,
      openingVoucher,
      trialBalanceStatus: {
        totalDebits: tb.totalDebits,
        totalCredits: tb.totalCredits,
        variance: tb.variance,
        isInBalance: tb.isInBalance,
      },
      counts: {
        customers: customerCount,
        vendors: vendorCount,
        products: productCount,
      },
      isReadyToGoLive:
        settings.isSetupCompleted ||
        (periods.length > 0 && tb.isInBalance && accounts.length > 0),
    });
  } catch (err: any) {
    console.error("GET /api/setup error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch setup status" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // STEP 1: SAVE COMPANY PROFILE & SEED FISCAL YEAR
    if (action === "save_company") {
      const {
        legalName,
        tradeName,
        addressText,
        phone,
        email,
        ntnNumber,
        strnNumber,
        fiscalYearStartMonth = 7,
      } = body;

      let settings = await prisma.companySettings.findFirst();
      if (settings) {
        settings = await prisma.companySettings.update({
          where: { id: settings.id },
          data: {
            legalName: legalName || settings.legalName,
            tradeName: tradeName || settings.tradeName,
            addressText: addressText || settings.addressText,
            phone: phone || settings.phone,
            email: email || settings.email,
            ntnNumber: ntnNumber || settings.ntnNumber,
            strnNumber: strnNumber || settings.strnNumber,
            fiscalYearStartMonth: Number(fiscalYearStartMonth) || 7,
          },
        });
      } else {
        settings = await prisma.companySettings.create({
          data: {
            legalName,
            tradeName,
            addressText,
            phone,
            email,
            ntnNumber,
            strnNumber,
            fiscalYearStartMonth: Number(fiscalYearStartMonth) || 7,
            baseCurrency: "PKR",
          },
        });
      }

      // Seed 12 Fiscal Periods automatically
      const currentYear = new Date().getFullYear();
      const periods = await FiscalPeriodService.seedFiscalYear(currentYear, Number(fiscalYearStartMonth) || 7);

      return NextResponse.json({
        success: true,
        settings,
        periodsCount: periods.length,
        message: "Company profile saved and fiscal periods initialized.",
      });
    }

    // STEP 2: POST OPENING BALANCES (OFFSET TO 3900 EQUITY)
    if (action === "post_opening_balances") {
      const { balances, goLiveDate, postedBy = "Accountant" } = body;
      // balances: Array of { accountCode: string, debit: number, credit: number }

      if (!balances || !Array.isArray(balances) || balances.length === 0) {
        return NextResponse.json({ error: "No opening balance rows provided." }, { status: 400 });
      }

      const targetDate = goLiveDate ? new Date(goLiveDate) : new Date();

      // Ensure 3900 Opening Balance Equity is provisioned
      const equityOffsetAcc = await AccountsPostingService.getAccountByCode("3900");

      let totalDebits = 0;
      let totalCredits = 0;
      const validLines: Array<{ accountId: string; debit: number; credit: number }> = [];

      for (const b of balances) {
        const d = Number(b.debit) || 0;
        const c = Number(b.credit) || 0;
        if (d === 0 && c === 0) continue;

        const acc = await AccountsPostingService.getAccountByCode(b.accountCode);
        validLines.push({
          accountId: acc.id,
          debit: d,
          credit: c,
        });

        totalDebits += d;
        totalCredits += c;
      }

      if (validLines.length === 0) {
        return NextResponse.json({ error: "All entered opening balances are zero." }, { status: 400 });
      }

      // Compute difference to offset into 3900 Opening Balance Equity
      const difference = Math.round((totalDebits - totalCredits) * 100) / 100;

      if (difference > 0) {
        // More debits: Credit 3900 Opening Balance Equity
        validLines.push({
          accountId: equityOffsetAcc.id,
          debit: 0,
          credit: difference,
        });
      } else if (difference < 0) {
        // More credits: Debit 3900 Opening Balance Equity
        validLines.push({
          accountId: equityOffsetAcc.id,
          debit: Math.abs(difference),
          credit: 0,
        });
      }

      // Check if an existing opening balance voucher was posted; if so, reverse it first to maintain append-only ledger
      const existingOpening = await prisma.journalEntry.findFirst({
        where: { refType: "opening_balance", status: "posted" },
      });

      if (existingOpening) {
        await AccountsPostingService.reverseEntry({
          journalEntryId: existingOpening.id,
          reversedBy: postedBy,
          reason: "Superseded by updated opening balance submission in Setup Wizard",
        });
      }

      const openingVoucher = await AccountsPostingService.post({
        date: targetDate,
        memo: `[GO-LIVE OPENING BALANCES] Initial Balances as of ${targetDate.toISOString().slice(0, 10)}`,
        refType: "opening_balance",
        refId: "GO_LIVE",
        postedBy,
        bypassPeriodLock: true,
        lines: validLines,
      });

      return NextResponse.json({
        success: true,
        openingVoucher,
        equityOffsetAmount: Math.abs(difference),
        message: `Opening balance voucher #${openingVoucher.id} posted. Net offset of PKR ${Math.abs(difference).toLocaleString()} placed into 3900 Opening Balance Equity.`,
      });
    }

    // STEP 3: MASTER DATA IMPORT (CUSTOMERS, VENDORS, INVENTORY)
    if (action === "import_master_data") {
      const { dataType, rows } = body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json({ error: "No data rows provided." }, { status: 400 });
      }

      let importedCount = 0;

      if (dataType === "customers") {
        for (const r of rows) {
          if (!r.name) continue;
          await prisma.customer.create({
            data: {
              name: r.name.trim(),
              phone: r.phone ? String(r.phone).trim() : "—",
              email: r.email ? String(r.email).trim() : null,
              addressText: r.address ? String(r.address).trim() : "Counter / Retail Customer",
            },
          });
          importedCount++;
        }
      } else if (dataType === "vendors") {
        for (const r of rows) {
          if (!r.name) continue;
          const wht = Number(r.whtRate) || 0;
          await prisma.vendor.create({
            data: {
              name: r.name.trim(),
              contactPerson: r.contactPerson ? String(r.contactPerson).trim() : null,
              phone: r.phone ? String(r.phone).trim() : null,
              email: r.email ? String(r.email).trim() : null,
              addressText: r.address ? String(r.address).trim() : null,
              ntnNumber: r.ntn ? String(r.ntn).trim() : null,
              whtRate: wht,
              whtExempt: Boolean(r.whtExempt),
            },
          });
          importedCount++;
        }
      } else if (dataType === "inventory") {
        for (const r of rows) {
          if (!r.name || !r.sku) continue;
          const cost = Number(r.costPrice) || 0;
          const price = Number(r.unitPrice) || cost * 1.3;
          const qty = Number(r.stockQuantity) || 0;

          const prod = await prisma.product.create({
            data: {
              sku: String(r.sku).trim(),
              name: String(r.name).trim(),
              unit: r.unit ? String(r.unit).trim() : "pcs",
              unitPrice: price,
              costPrice: cost,
              stockQuantity: qty,
              reorderLevel: Number(r.reorderLevel) || 5,
            },
          });

          if (qty > 0) {
            await prisma.stockLedger.create({
              data: {
                productId: prod.id,
                qty,
                direction: "in",
                refType: "adjustment",
                notes: "Opening stock balance from initial system setup",
              },
            });
          }

          importedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        dataType,
        importedCount,
        message: `Successfully imported ${importedCount} ${dataType} records.`,
      });
    }

    // STEP 4: GO-LIVE SIGN-OFF
    if (action === "complete_setup") {
      const tb = await FinancialReportingService.getTrialBalance();
      if (!tb.isInBalance) {
        return NextResponse.json(
          {
            error: `Cannot complete go-live: Trial balance is not in equilibrium (Variance: PKR ${tb.variance}). Debits must equal credits.`,
          },
          { status: 400 }
        );
      }

      let settings = await prisma.companySettings.findFirst();
      if (!settings) {
        settings = await prisma.companySettings.create({
          data: {
            legalName: "Enterprise Services (Pvt) Ltd",
            isSetupCompleted: true,
            goLiveDate: new Date(),
          },
        });
      } else {
        settings = await prisma.companySettings.update({
          where: { id: settings.id },
          data: {
            isSetupCompleted: true,
            goLiveDate: new Date(),
          },
        });
      }

      return NextResponse.json({
        success: true,
        settings,
        message: "Congratulations! System setup is officially complete and verified. Go-live unlocked!",
      });
    }

    return NextResponse.json({ error: "Invalid action parameter." }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/setup error:", err);
    return NextResponse.json({ error: err.message || "Failed to process setup action." }, { status: 500 });
  }
}
