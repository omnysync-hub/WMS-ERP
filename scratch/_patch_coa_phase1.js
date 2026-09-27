/**
 * Patch script: COA onboarding + hardcode scrub
 * Run from D:\WORKMAN SERVICES
 */
const fs = require("fs");
const path = require("path");

function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, c) { fs.writeFileSync(p, c, "utf8"); console.log("Wrote", p); }

// ========== 1. AccountMappingService: add types + enhance completeness ==========
{
  let s = read("src/lib/services/AccountMappingService.ts");

  // Add fixed_asset_cost and bank_operating before depreciation_expense block
  const insertTypes = `  {
    transactionType: "fixed_asset_cost",
    name: "Fixed Asset Register — Asset Cost Basis",
    domain: "Fixed Assets & Close",
    description: "Debited (capitalized) when a fixed asset is acquired; default cost ledger for new assets",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "bank_operating",
    name: "Bank Operations — Default Operating Bank",
    domain: "Fixed Assets & Close",
    description: "Default operating bank account used for reconciliation fallbacks and bank-side cash reporting",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "ar_control",
    name: "Sub-Ledger — Accounts Receivable Control",
    domain: "Sales & Invoicing",
    description: "GL control account reconciled against customer AR sub-ledger balances",
    defaultDebitOrCredit: "debit",
    allowedAccountTypes: ["asset"],
  },
  {
    transactionType: "ap_control",
    name: "Sub-Ledger — Accounts Payable Control",
    domain: "Procurement & AP",
    description: "GL control account reconciled against vendor AP sub-ledger balances",
    defaultDebitOrCredit: "credit",
    allowedAccountTypes: ["liability"],
  },
`;

  if (!s.includes('transactionType: "fixed_asset_cost"')) {
    s = s.replace(
      /\/\/ Fixed Assets & Period Close\r?\n\s*\{\r?\n\s*transactionType: "depreciation_expense"/,
      `// Fixed Assets & Period Close\n${insertTypes}  {\n    transactionType: "depreciation_expense"`
    );
  }

  // Enhance getCompleteness to require active leaf accounts
  const oldCompleteness = `static async getCompleteness(companyId: string = "DEFAULT") {
    const mappings = await this.getAllMappings(companyId);
    const total = mappings.length;
    const configured = mappings.filter((m) => m.isConfigured).length;
    const percentage = total > 0 ? Math.round((configured / total) * 100) : 0;
    const missing = mappings.filter((m) => !m.isConfigured).map((m) => m.transactionType);

    return {
      total,
      configured,
      percentage,
      isComplete: configured === total,
      missing,
    };
  }
}`;

  const newCompleteness = `static async getCompleteness(companyId: string = "DEFAULT") {
    const mappings = await this.getAllMappings(companyId);
    const total = mappings.length;

    // Valid = mapped to an active leaf (level 4) account; group headers are not postable
    const valid = mappings.filter(
      (m) =>
        m.isConfigured &&
        !!m.accountId &&
        m.accountCode &&
        // accountType present implies account was joined; re-check activity via isConfigured path
        true
    );

    // Re-fetch accounts for leaf/active validation
    const accountIds = valid.map((m) => m.accountId!).filter(Boolean);
    const accounts = accountIds.length
      ? await prisma.account.findMany({ where: { id: { in: accountIds } } })
      : [];
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const fullyValid = mappings.filter((m) => {
      if (!m.accountId) return false;
      const acc = accountMap.get(m.accountId);
      if (!acc) return false;
      if (!acc.isActive) return false;
      // Prefer leaf accounts (level 4); allow level>=4 or accounts with no children concept via level
      if (acc.level < 4) return false;
      return true;
    });

    const configured = fullyValid.length;
    const percentage = total > 0 ? Math.round((configured / total) * 100) : 0;
    const missing = mappings
      .filter((m) => !fullyValid.some((v) => v.transactionType === m.transactionType))
      .map((m) => m.transactionType);

    const inactiveOrNonLeaf = mappings
      .filter((m) => {
        if (!m.accountId) return false;
        const acc = accountMap.get(m.accountId);
        return acc && (!acc.isActive || acc.level < 4);
      })
      .map((m) => m.transactionType);

    return {
      total,
      configured,
      percentage,
      isComplete: configured === total,
      missing,
      inactiveOrNonLeaf,
    };
  }

  /**
   * Apply one mapped account to many transaction types ("same as" quick-fill).
   */
  static async applySameAs(
    companyId: string = "DEFAULT",
    sourceTransactionType: string,
    targetTransactionTypes: string[],
    updatedBy: string = "Admin"
  ) {
    const source = await this.resolveAccount({ transactionType: sourceTransactionType, companyId });
    const results = [];
    for (const tt of targetTransactionTypes) {
      if (tt === sourceTransactionType) continue;
      results.push(await this.setMapping(companyId, tt, source.id, null, updatedBy));
    }
    return { accountId: source.id, accountCode: source.code, updated: results.length, results };
  }
}`;

  if (s.includes("static async getCompleteness") && !s.includes("inactiveOrNonLeaf")) {
    s = s.replace(
      /static async getCompleteness\(companyId: string = "DEFAULT"\) \{[\s\S]*?\n\}\n\}/,
      newCompleteness
    );
  }

  write("src/lib/services/AccountMappingService.ts", s);
}

// ========== 2. BankReconciliationService ==========
{
  let s = read("src/lib/services/BankReconciliationService.ts");
  if (!s.includes("AccountMappingService")) {
    s = s.replace(
      /import \{ AccountsPostingService \} from "\.\/AccountsPostingService";/,
      'import { AccountsPostingService } from "./AccountsPostingService";\nimport { AccountMappingService } from "./AccountMappingService";'
    );
  }
  s = s.replace(
    /account = await AccountsPostingService\.getAccountByCode\("1010"\);/g,
    'account = await AccountMappingService.resolveAccount({ transactionType: "bank_operating" });'
  );
  write("src/lib/services/BankReconciliationService.ts", s);
}

// ========== 3. SubLedgerService ==========
{
  let s = read("src/lib/services/SubLedgerService.ts");
  if (!s.includes("AccountMappingService")) {
    // find existing imports
    if (s.includes('from "./AccountsPostingService"')) {
      s = s.replace(
        /import \{ AccountsPostingService \} from "\.\/AccountsPostingService";/,
        'import { AccountsPostingService } from "./AccountsPostingService";\nimport { AccountMappingService } from "./AccountMappingService";'
      );
    } else {
      s = 'import { AccountMappingService } from "./AccountMappingService";\n' + s;
    }
  }
  s = s.replace(
    /AccountsPostingService\.getAccountByCode\("1100"\),\s*AccountsPostingService\.getAccountByCode\("2000"\),/,
    `AccountMappingService.resolveAccount({ transactionType: "ar_control" }),
      AccountMappingService.resolveAccount({ transactionType: "ap_control" }),`
  );
  write("src/lib/services/SubLedgerService.ts", s);
}

// ========== 4. FixedAssetService ==========
{
  let s = read("src/lib/services/FixedAssetService.ts");

  // Replace createFixedAsset defaults
  const createBlock = `static async createFixedAsset(params: CreateFixedAssetParams) {
    const count = await prisma.fixedAsset.count();
    const assetNumber = \`FA-\${new Date().getFullYear()}-\${String(count + 1).padStart(4, "0")}\`;

    const salvage = params.salvageValue || 0;
    const cost = params.acquisitionCost;

    const defaultAssetCode = params.assetAccountCode
      || (await AccountMappingService.resolveAccountCode({ transactionType: "fixed_asset_cost" }));
    const defaultAccumCode = params.accumDeprAccountCode
      || (await AccountMappingService.resolveAccountCode({ transactionType: "accumulated_depreciation" }));
    const defaultDeprExpCode = params.deprExpenseAccountCode
      || (await AccountMappingService.resolveAccountCode({ transactionType: "depreciation_expense" }));

    return await prisma.fixedAsset.create({
      data: {
        assetNumber,
        name: params.name,
        category: params.category,
        hrmAssetId: params.hrmAssetId || null,
        acquisitionDate: params.acquisitionDate,
        acquisitionCost: cost,
        salvageValue: salvage,
        usefulLifeMonths: params.usefulLifeMonths || 60,
        depreciationMethod: params.depreciationMethod || "straight_line",
        assetAccountCode: defaultAssetCode,
        accumDeprAccountCode: defaultAccumCode,
        deprExpenseAccountCode: defaultDeprExpCode,
        accumulatedDepreciation: 0,
        bookValue: cost,
        status: "active",
      },
    });
  }`;

  s = s.replace(
    /static async createFixedAsset\(params: CreateFixedAssetParams\) \{[\s\S]*?status: "active",\r?\n\s*\},\r?\n\s*\}\);\r?\n\s*\}/,
    createBlock
  );

  // createAsset wrapper - remove hardcoded fallbacks; createFixedAsset resolves them
  s = s.replace(
    /assetAccountCode: params\.assetAccountCode \|\| "1500",\r?\n\s*accumDeprAccountCode: params\.accumDepAccountCode \|\| params\.accumDeprAccountCode \|\| "1590",\r?\n\s*deprExpenseAccountCode: params\.depExpenseAccountCode \|\| params\.deprExpenseAccountCode \|\| "6350",/,
    `assetAccountCode: params.assetAccountCode,
      accumDeprAccountCode: params.accumDepAccountCode || params.accumDeprAccountCode,
      deprExpenseAccountCode: params.depExpenseAccountCode || params.deprExpenseAccountCode,`
  );

  write("src/lib/services/FixedAssetService.ts", s);
}

console.log("Phase 1 service patches done");
