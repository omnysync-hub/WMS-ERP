export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { AccountMappingService } from "@/lib/services/AccountMappingService";
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

    const mappingCompleteness = await AccountMappingService.getCompleteness("DEFAULT");
    const leafAccounts = accounts.filter((a) => a.level >= 4 && a.isActive);

    return NextResponse.json({
      success: true,
      settings,
      periodsCount: periods.length,
      periods,
      accounts: leafAccounts,
      allAccounts: accounts,
      openingVoucher,
      mappingCompleteness,
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
        (periods.length > 0 &&
          tb.isInBalance &&
          leafAccounts.length > 0 &&
          mappingCompleteness.isComplete),
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

      // Ensure Opening Balance Equity is resolved via AccountMappingService
      const equityOffsetAcc = await AccountMappingService.resolveAccount({ transactionType: "opening_balance_equity" });

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
      const mappingCompleteness = await AccountMappingService.getCompleteness("DEFAULT");
      if (!mappingCompleteness.isComplete) {
        return NextResponse.json(
          {
            error: `Cannot complete go-live: Account mapping is ${mappingCompleteness.percentage}% complete (${mappingCompleteness.configured}/${mappingCompleteness.total}). Map all required transaction types to active leaf accounts first.`,
            mappingCompleteness,
          },
          { status: 400 }
        );
      }

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


    // COA CSV/JSON IMPORT (wires same validation as /api/accounts bulk_import_accounts)
    if (action === "import_coa") {
      const { rows, companyId = "DEFAULT" } = body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json({ error: "No COA rows provided. Expected columns: code, name, type, parentCode?, isActive?" }, { status: 400 });
      }

      // Delegate through AccountsPostingService-compatible path by calling the same logic inline
      const VALID_ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense", "contra_revenue"];
      const seenCodes = new Set();
      const errors = [];
      let createdCount = 0;
      let updatedCount = 0;
      let deactivatedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const item = rows[i];
        const code = item?.code != null ? String(item.code).trim() : "";
        if (!code) { errors.push(`Row ${i + 1}: code is required`); continue; }
        if (seenCodes.has(code)) errors.push(`Row ${i + 1}: duplicate code "${code}"`);
        seenCodes.add(code);
        if (!item.name || !String(item.name).trim()) errors.push(`Row ${i + 1} (${code}): name is required`);
        const type = item.type ? String(item.type).trim().toLowerCase() : "";
        if (!VALID_ACCOUNT_TYPES.includes(type)) {
          errors.push(`Row ${i + 1} (${code}): type must be one of ${VALID_ACCOUNT_TYPES.join(", ")}`);
        }
      }
      if (errors.length) {
        return NextResponse.json({ error: "COA import validation failed", details: errors.slice(0, 25) }, { status: 400 });
      }

      for (const item of rows) {
        const code = String(item.code).trim();
        const type = String(item.type).trim().toLowerCase();
        const name = String(item.name).trim();
        const isActive =
          item.isActive === undefined || item.isActive === null
            ? true
            : String(item.isActive).toLowerCase() !== "false" && item.isActive !== false && item.isActive !== 0 && item.isActive !== "0";
        const level = item.level != null ? Number(item.level) : 4;
        let parentId = item.parentId || null;
        if (item.parentCode) {
          const parent = await prisma.account.findUnique({ where: { code: String(item.parentCode).trim() } });
          if (!parent) {
            errors.push(`Account ${code}: parentCode "${item.parentCode}" not found`);
            continue;
          }
          parentId = parent.id;
        }

        const existing = await prisma.account.findUnique({ where: { code } });
        if (existing) {
          await prisma.account.update({
            where: { id: existing.id },
            data: {
              name,
              type,
              description: item.description || existing.description,
              level: Number.isFinite(level) ? level : existing.level,
              parentId: parentId != null ? parentId : existing.parentId,
              isActive,
              companyId: existing.companyId || companyId,
            },
          });
          updatedCount++;
          if (!isActive && existing.isActive) deactivatedCount++;
        } else {
          await prisma.account.create({
            data: {
              code,
              name,
              type,
              description: item.description || null,
              level: Number.isFinite(level) ? level : 4,
              parentId,
              companyId,
              currency: "PKR",
              isSystem: false,
              isActive,
            },
          });
          createdCount++;
        }
      }

      return NextResponse.json({
        success: true,
        createdCount,
        updatedCount,
        deactivatedCount,
        warnings: errors.length ? errors : undefined,
        message: `COA import complete: ${createdCount} created, ${updatedCount} updated${deactivatedCount ? `, ${deactivatedCount} deactivated` : ""}.`,
      });
    }

    // Ensure Workman template leaf accounts exist (idempotent) without deleting posted history
    if (action === "ensure_template_coa") {
      const companyId = body.companyId || "DEFAULT";
      let created = 0;
      for (const def of STANDARD_COA_DEFINITIONS) {
        if (def.isGroup) continue;
        const existing = await prisma.account.findUnique({ where: { code: def.code } });
        if (!existing) {
          let parentId = null;
          if (def.parentCode) {
            const parent = await prisma.account.findUnique({ where: { code: def.parentCode } });
            parentId = parent?.id || null;
          }
          await prisma.account.create({
            data: {
              code: def.code,
              name: def.name,
              type: def.type,
              description: def.description || null,
              level: def.level || 4,
              parentId,
              companyId,
              currency: "PKR",
              isSystem: true,
              isActive: true,
            },
          });
          created++;
        }
      }
      return NextResponse.json({
        success: true,
        created,
        message: created ? `Provisioned ${created} missing template leaf accounts.` : "Template COA already present.",
      });
    }

    // Seed / upsert baseline mappings for DEFAULT company (includes newly introduced roles)
    if (action === "seed_baseline_mappings") {
      const companyId = body.companyId || "DEFAULT";
      const baseline = [
        { transactionType: "job_revenue_receivable", accountCode: "1100" },
        { transactionType: "job_revenue_sales", accountCode: "4000" },
        { transactionType: "job_revenue_discount", accountCode: "4100" },
        { transactionType: "customer_payment_receiving", accountCode: "1000" },
        { transactionType: "customer_payment_receivable", accountCode: "1100" },
        { transactionType: "expense_reimbursement_expense", accountCode: "6100" },
        { transactionType: "expense_reimbursement_disbursing", accountCode: "1000" },
        { transactionType: "inventory_cogs_expense", accountCode: "5000" },
        { transactionType: "inventory_cogs_asset", accountCode: "1200" },
        { transactionType: "inventory_return_asset", accountCode: "1200" },
        { transactionType: "inventory_return_cogs", accountCode: "5000" },
        { transactionType: "stock_in_asset", accountCode: "1200" },
        { transactionType: "stock_in_disbursing", accountCode: "1000" },
        { transactionType: "opening_stock_asset", accountCode: "1200" },
        { transactionType: "opening_stock_equity", accountCode: "3000" },
        { transactionType: "grn_receipt_asset", accountCode: "1200" },
        { transactionType: "grn_receipt_clearing", accountCode: "2050" },
        { transactionType: "grn_receipt_payable", accountCode: "2000" },
        { transactionType: "vendor_bill_clearing", accountCode: "2050" },
        { transactionType: "vendor_bill_payable", accountCode: "2000" },
        { transactionType: "vendor_bill_ppv", accountCode: "5050" },
        { transactionType: "vendor_payment_payable", accountCode: "2000" },
        { transactionType: "vendor_payment_disbursing", accountCode: "1010" },
        { transactionType: "vendor_payment_wht", accountCode: "2200" },
        { transactionType: "payroll_salaries_expense", accountCode: "6000" },
        { transactionType: "payroll_net_disbursing", accountCode: "1000" },
        { transactionType: "payroll_advance_deduction", accountCode: "1150" },
        { transactionType: "advance_granted_receivable", accountCode: "1150" },
        { transactionType: "advance_granted_disbursing", accountCode: "1000" },
        { transactionType: "pos_sale_cash", accountCode: "1000" },
        { transactionType: "pos_sale_bank", accountCode: "1010" },
        { transactionType: "pos_sale_receivable", accountCode: "1100" },
        { transactionType: "pos_sale_revenue", accountCode: "4000" },
        { transactionType: "cashbook_contra_revenue", accountCode: "4000" },
        { transactionType: "cashbook_contra_expense", accountCode: "6200" },
        { transactionType: "settlement_collection_vault", accountCode: "1000" },
        { transactionType: "settlement_collection_receivable", accountCode: "1100" },
        { transactionType: "tech_expense_settlement_expense", accountCode: "6100" },
        { transactionType: "tech_expense_settlement_vault", accountCode: "1000" },
        { transactionType: "tech_expense_settlement_payable", accountCode: "2100" },
        { transactionType: "fixed_asset_cost", accountCode: "1500" },
        { transactionType: "bank_operating", accountCode: "1010" },
        { transactionType: "ar_control", accountCode: "1100" },
        { transactionType: "ap_control", accountCode: "2000" },
        { transactionType: "depreciation_expense", accountCode: "6350" },
        { transactionType: "accumulated_depreciation", accountCode: "1590" },
        { transactionType: "retained_earnings_equity", accountCode: "3200" },
        { transactionType: "opening_balance_equity", accountCode: "3900" },
      ];

      let upserted = 0;
      let skipped = 0;
      for (const m of baseline) {
        const acc = await prisma.account.findUnique({ where: { code: m.accountCode } });
        if (!acc) { skipped++; continue; }
        await AccountMappingService.setMapping(companyId, m.transactionType, acc.id, null, "Setup Wizard");
        upserted++;
      }
      const completeness = await AccountMappingService.getCompleteness(companyId);
      return NextResponse.json({
        success: true,
        upserted,
        skipped,
        completeness,
        message: `Baseline mappings applied (${upserted} upserted, ${skipped} skipped missing accounts).`,
      });
    }

    // Deactivate unused Workman default leaves that have never been posted (safe)
    if (action === "deactivate_unused_defaults") {
      const { codes } = body;
      if (!Array.isArray(codes) || codes.length === 0) {
        return NextResponse.json({ error: "codes[] required" }, { status: 400 });
      }
      const results = [];
      for (const code of codes) {
        const acc = await prisma.account.findUnique({
          where: { code: String(code) },
          include: { _count: { select: { journalLines: true, mappings: true } } },
        });
        if (!acc) { results.push({ code, status: "not_found" }); continue; }
        if (acc._count.journalLines > 0) {
          // Soft-deactivate only — never delete historical
          await prisma.account.update({ where: { id: acc.id }, data: { isActive: false } });
          results.push({ code, status: "deactivated_has_history" });
        } else if (acc._count.mappings > 0) {
          await prisma.account.update({ where: { id: acc.id }, data: { isActive: false } });
          results.push({ code, status: "deactivated_still_mapped" });
        } else {
          await prisma.account.update({ where: { id: acc.id }, data: { isActive: false } });
          results.push({ code, status: "deactivated" });
        }
      }
      return NextResponse.json({ success: true, results });
    }


    return NextResponse.json({ error: "Invalid action parameter." }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/setup error:", err);
    return NextResponse.json({ error: err.message || "Failed to process setup action." }, { status: 500 });
  }
}
