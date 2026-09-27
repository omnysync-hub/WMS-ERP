const fs = require("fs");
let s = fs.readFileSync("src/app/api/setup/route.ts", "utf8");

// 1. Enhance GET to include mapping completeness + leaf accounts only for OB
{
  const oldReturn = `return NextResponse.json({
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
    });`;

  const newReturn = `const mappingCompleteness = await AccountMappingService.getCompleteness("DEFAULT");
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
    });`;

  if (!s.includes("mappingCompleteness")) {
    s = s.replace(oldReturn, newReturn);
  }
}

// 2. Gate complete_setup on mapping completeness
{
  const oldComplete = `if (action === "complete_setup") {
      const tb = await FinancialReportingService.getTrialBalance();
      if (!tb.isInBalance) {
        return NextResponse.json(
          {
            error: \`Cannot complete go-live: Trial balance is not in equilibrium (Variance: PKR \${tb.variance}). Debits must equal credits.\`,
          },
          { status: 400 }
        );
      }`;

  const newComplete = `if (action === "complete_setup") {
      const mappingCompleteness = await AccountMappingService.getCompleteness("DEFAULT");
      if (!mappingCompleteness.isComplete) {
        return NextResponse.json(
          {
            error: \`Cannot complete go-live: Account mapping is \${mappingCompleteness.percentage}% complete (\${mappingCompleteness.configured}/\${mappingCompleteness.total}). Map all required transaction types to active leaf accounts first.\`,
            mappingCompleteness,
          },
          { status: 400 }
        );
      }

      const tb = await FinancialReportingService.getTrialBalance();
      if (!tb.isInBalance) {
        return NextResponse.json(
          {
            error: \`Cannot complete go-live: Trial balance is not in equilibrium (Variance: PKR \${tb.variance}). Debits must equal credits.\`,
          },
          { status: 400 }
        );
      }`;

  if (!s.includes("Account mapping is")) {
    s = s.replace(oldComplete, newComplete);
  }
}

// 3. Add import_coa + seed_baseline_mappings + ensure_template actions before Invalid action
{
  if (!s.includes('action === "import_coa"')) {
    const insertBefore = '    return NextResponse.json({ error: "Invalid action parameter." }, { status: 400 });';
    const newActions = `
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
        if (!code) { errors.push(\`Row \${i + 1}: code is required\`); continue; }
        if (seenCodes.has(code)) errors.push(\`Row \${i + 1}: duplicate code "\${code}"\`);
        seenCodes.add(code);
        if (!item.name || !String(item.name).trim()) errors.push(\`Row \${i + 1} (\${code}): name is required\`);
        const type = item.type ? String(item.type).trim().toLowerCase() : "";
        if (!VALID_ACCOUNT_TYPES.includes(type)) {
          errors.push(\`Row \${i + 1} (\${code}): type must be one of \${VALID_ACCOUNT_TYPES.join(", ")}\`);
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
            errors.push(\`Account \${code}: parentCode "\${item.parentCode}" not found\`);
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
        message: \`COA import complete: \${createdCount} created, \${updatedCount} updated\${deactivatedCount ? \`, \${deactivatedCount} deactivated\` : ""}.\`,
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
        message: created ? \`Provisioned \${created} missing template leaf accounts.\` : "Template COA already present.",
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
        message: \`Baseline mappings applied (\${upserted} upserted, \${skipped} skipped missing accounts).\`,
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

`;
    s = s.replace(insertBefore, newActions + "\n" + insertBefore);
  }
}

fs.writeFileSync("src/app/api/setup/route.ts", s);
console.log("setup route patched, length=", s.length);
