import { prisma } from "../prisma";
import { AccountMappingService, TRANSACTION_TYPE_DEFINITIONS } from "./AccountMappingService";
import { Account, AccountMappingAudit } from "@prisma/client";

export interface PatternRule {
  id: string;
  name: string;
  category: string;
  keywords: string[];
  targetAccountCode: string;
  targetAccountName: string;
  targetAccountType: "expense" | "asset" | "liability" | "revenue";
  parentControlCode: string; // Level 3 parent code
  applicableTransactionTypes: string[];
  baseConfidence: number;
  explanationTemplate: (count: number, totalAmount: number, sampleWords: string[]) => string;
}

export interface SuggestionResult {
  id: string;
  transactionType: string;
  transactionTypeName: string;
  domain: string;
  currentAccountId: string | null;
  currentAccountCode: string | null;
  currentAccountName: string | null;
  suggestedAccountId: string;
  suggestedAccountCode: string;
  suggestedAccountName: string;
  suggestedAccountType: string;
  confidenceScore: number;
  confidencePercentage: number;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  rationale: string;
  sourceTransactionIds: string[];
  sampleDescriptions: string[];
  totalAmountSampled: number;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export const KNOWN_PATTERNS: PatternRule[] = [
  {
    id: "technician_fuel",
    name: "Vehicle Fuel & Petrol Expenses",
    category: "Field Operations",
    keywords: ["fuel", "petrol", "cng", "diesel", "filling station", "pump", "bike petrol", "van fuel", "mileage", "fueling"],
    targetAccountCode: "6110",
    targetAccountName: "Technician Vehicle & Fuel Expenses",
    targetAccountType: "expense",
    parentControlCode: "6120-CTRL", // Field Operations & Transit Control
    applicableTransactionTypes: ["expense_reimbursement_expense", "tech_expense_settlement_expense"],
    baseConfidence: 0.94,
    explanationTemplate: (count, totalAmount, samples) =>
      `Detected ${count} fuel/petrol expense voucher(s) totaling PKR ${totalAmount.toLocaleString()} (${samples.slice(0, 2).join("; ")}). Recommend splitting from general travel into dedicated Fuel & Petrol Expense account.`,
  },
  {
    id: "transit_conveyance",
    name: "Local Transit & Conveyance",
    category: "Field Operations",
    keywords: ["rickshaw", "rikshaw", "chingchi", "uber", "careem", "indrive", "fare", "transit", "metro", "bus fare", "commute", "cab fare"],
    targetAccountCode: "6120",
    targetAccountName: "Technician Local Transit & Conveyance",
    targetAccountType: "expense",
    parentControlCode: "6120-CTRL",
    applicableTransactionTypes: ["expense_reimbursement_expense", "tech_expense_settlement_expense"],
    baseConfidence: 0.91,
    explanationTemplate: (count, totalAmount, samples) =>
      `Detected ${count} local transit/ride-hailing voucher(s) totaling PKR ${totalAmount.toLocaleString()} (${samples.slice(0, 2).join("; ")}). Recommend isolating transit fares from broad travel overheads.`,
  },
  {
    id: "direct_job_supplies",
    name: "Direct Job Supplies & Small Spares",
    category: "Direct Cost / COGS",
    keywords: [
      "copper pipe",
      "insulation",
      "r22",
      "r410",
      "freon",
      "refrigerant",
      "gas charge",
      "capacitor",
      "fasteners",
      "screws",
      "drill bit",
      "tape",
      "teflon",
      "clamp",
      "elbow",
      "union",
      "flaring",
      "hardware store",
      "brazing rod",
    ],
    targetAccountCode: "5100",
    targetAccountName: "Direct Job Supplies & Small Tools",
    targetAccountType: "expense",
    parentControlCode: "5110", // Direct Materials & Parts Consumption
    applicableTransactionTypes: ["expense_reimbursement_expense", "inventory_cogs_expense"],
    baseConfidence: 0.88,
    explanationTemplate: (count, totalAmount, samples) =>
      `Detected ${count} direct emergency parts/supplies transaction(s) totaling PKR ${totalAmount.toLocaleString()} (${samples.slice(0, 2).join("; ")}). Recommend mapping directly to COGS / Direct Supplies instead of operating expense.`,
  },
  {
    id: "staff_refreshments",
    name: "Staff Meals & Field Refreshments",
    category: "Field Operations",
    keywords: ["lunch", "dinner", "tea", "refreshment", "meals", "water bottle", "breakfast", "overtime meal", "food", "snacks"],
    targetAccountCode: "6130",
    targetAccountName: "Staff Meals & Field Refreshments",
    targetAccountType: "expense",
    parentControlCode: "6120-CTRL",
    applicableTransactionTypes: ["expense_reimbursement_expense", "tech_expense_settlement_expense"],
    baseConfidence: 0.86,
    explanationTemplate: (count, totalAmount, samples) =>
      `Detected ${count} technician food/refreshment voucher(s) totaling PKR ${totalAmount.toLocaleString()} (${samples.slice(0, 2).join("; ")}). Recommend routing to dedicated Staff Meals & Refreshments.`,
  },
  {
    id: "office_utilities",
    name: "Office Utilities & Electricity",
    category: "General & Admin",
    keywords: ["lesco", "wapda", "electricity bill", "k-electric", "gas bill", "sngpl", "utility bill", "water bill", "power bill"],
    targetAccountCode: "6170",
    targetAccountName: "Office Utilities (Electricity & Water)",
    targetAccountType: "expense",
    parentControlCode: "6130-CTRL", // General Office & Admin Overheads
    applicableTransactionTypes: ["cashbook_contra_expense"],
    baseConfidence: 0.95,
    explanationTemplate: (count, totalAmount, samples) =>
      `Detected ${count} utility bill disbursement(s) totaling PKR ${totalAmount.toLocaleString()} (${samples.slice(0, 2).join("; ")}). Recommend isolating utility expenses into dedicated account.`,
  },
  {
    id: "telecom_internet",
    name: "Internet & Telecom Subscriptions",
    category: "General & Admin",
    keywords: ["internet", "stormfiber", "ptcl", "nayatel", "fiber", "wifi", "data bundle", "sim card", "telecom", "phone bill", "mobile load", "zong", "jazz"],
    targetAccountCode: "6201",
    targetAccountName: "Internet & Telecom Subscriptions",
    targetAccountType: "expense",
    parentControlCode: "6130-CTRL",
    applicableTransactionTypes: ["cashbook_contra_expense"],
    baseConfidence: 0.96,
    explanationTemplate: (count, totalAmount, samples) =>
      `Detected ${count} connectivity and telecom payment(s) totaling PKR ${totalAmount.toLocaleString()} (${samples.slice(0, 2).join("; ")}). Matches existing Internet & Telecom Subscriptions account.`,
  },
  {
    id: "printing_stationery",
    name: "Printer Ink & Office Stationery",
    category: "General & Admin",
    keywords: ["stationery", "photocopy", "printer ink", "toner", "paper rim", "stapler", "files", "office register", "invoice book"],
    targetAccountCode: "6202",
    targetAccountName: "Printer Ink & Office Stationery",
    targetAccountType: "expense",
    parentControlCode: "6130-CTRL",
    applicableTransactionTypes: ["cashbook_contra_expense"],
    baseConfidence: 0.93,
    explanationTemplate: (count, totalAmount, samples) =>
      `Detected ${count} printing/stationery invoice(s) totaling PKR ${totalAmount.toLocaleString()} (${samples.slice(0, 2).join("; ")}). Matches existing Printer Ink & Office Stationery account.`,
  },
];

export class AccountSuggestionAgent {
  /**
   * Ensures an account exists in the database. If it does not exist,
   * creates it as an active Level 4 account under the specified parent.
   */
  private static async ensureAccountExists(
    code: string,
    name: string,
    type: string,
    parentControlCode: string,
    companyId: string = "DEFAULT"
  ): Promise<Account> {
    let account = await prisma.account.findUnique({ where: { code } });
    if (account) return account;

    // Find parent control account
    const parent = await prisma.account.findUnique({ where: { code: parentControlCode } });

    account = await prisma.account.create({
      data: {
        code,
        name,
        type,
        level: 4,
        parentId: parent ? parent.id : null,
        isSystem: false,
        isActive: true,
        companyId,
        currency: "PKR",
        description: `Auto-proposed by AI Suggestion Agent under ${parent?.name || parentControlCode}`,
      },
    });

    return account;
  }

  /**
   * Scans all historical transactions (JobExpenseClaim, JournalEntry, StockLedger)
   * to detect transaction clusters and generic account misclassifications.
   * Generates or updates proposals in AccountMappingAudit.
   */
  static async scanTransactions(companyId: string = "DEFAULT"): Promise<{
    scannedCount: number;
    newSuggestionsCount: number;
    updatedCount: number;
    suggestions: SuggestionResult[];
  }> {
    // 1. Gather all historical transaction text
    const [expenseClaims, journalEntries, stockLedgers] = await Promise.all([
      prisma.jobExpenseClaim.findMany({
        select: { id: true, note: true, amount: true, status: true, createdAt: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      }),
      prisma.journalEntry.findMany({
        select: {
          id: true,
          memo: true,
          refType: true,
          createdAt: true,
          lines: {
            select: {
              debit: true,
              credit: true,
              account: { select: { id: true, code: true, name: true, type: true } },
            },
          },
        },
        take: 500,
        orderBy: { createdAt: "desc" },
      }),
      prisma.stockLedger.findMany({
        select: {
          id: true,
          notes: true,
          refType: true,
          qty: true,
          product: { select: { name: true, sku: true } },
          createdAt: true,
        },
        take: 200,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalScanned = expenseClaims.length + journalEntries.length + stockLedgers.length;

    // 2. Fetch current mappings to understand current assignments
    const currentMappings = await AccountMappingService.getAllMappings(companyId);
    const mappingMap = new Map<string, typeof currentMappings[0]>();
    for (const m of currentMappings) {
      mappingMap.set(m.transactionType, m);
    }

    // 3. Evaluate each pattern rule against historical transactions
    let newCount = 0;
    let updatedCount = 0;

    for (const pattern of KNOWN_PATTERNS) {
      // Find matching items
      const matchedExpenseClaims = expenseClaims.filter((e) =>
        pattern.keywords.some((k) => e.note.toLowerCase().includes(k.toLowerCase()))
      );

      const matchedJournalEntries = journalEntries.filter((j) =>
        pattern.keywords.some((k) => j.memo.toLowerCase().includes(k.toLowerCase()))
      );

      const matchedStockEntries = stockLedgers.filter((s) => {
        const text = `${s.notes || ""} ${s.product?.name || ""} ${s.product?.sku || ""}`.toLowerCase();
        return pattern.keywords.some((k) => text.includes(k.toLowerCase()));
      });

      const matchCount = matchedExpenseClaims.length + matchedJournalEntries.length + matchedStockEntries.length;
      const allTxIds = [
        ...matchedExpenseClaims.map((e) => e.id),
        ...matchedJournalEntries.map((j) => j.id),
        ...matchedStockEntries.map((s) => s.id),
      ];

      const sampleNotes = [
        ...matchedExpenseClaims.map((e) => e.note),
        ...matchedJournalEntries.map((j) => j.memo),
        ...matchedStockEntries.map((s) => `${s.product?.name || "Product"}: ${s.notes || ""}`),
      ].filter(Boolean);

      const totalAmount =
        matchedExpenseClaims.reduce((acc, c) => acc + c.amount, 0) +
        matchedJournalEntries.reduce((acc, j) => {
          const maxLine = Math.max(...j.lines.map((l) => Math.max(l.debit, l.credit)), 0);
          return acc + maxLine;
        }, 0);

      // Check applicable transaction types
      for (const tType of pattern.applicableTransactionTypes) {
        const currentMapping = mappingMap.get(tType);
        const isCurrentlyGenericOrDifferent =
          !currentMapping?.accountCode ||
          currentMapping.accountCode === "6100" ||
          currentMapping.accountCode === "6200" ||
          currentMapping.accountCode === "5000" ||
          currentMapping.accountCode !== pattern.targetAccountCode;

        // If we found live transaction matches OR if the transaction type is mapped to a broad generic account
        if (matchCount > 0 || isCurrentlyGenericOrDifferent) {
          // Adjust confidence: boost if we have repeated matches
          let confidence = pattern.baseConfidence;
          if (matchCount > 5) confidence = Math.min(0.98, confidence + 0.04);
          else if (matchCount === 0) confidence = Math.max(0.72, confidence - 0.15);

          // Check if target account already exists in DB (DO NOT auto-create during scan!)
          const existingAccount = await prisma.account.findUnique({
            where: { code: pattern.targetAccountCode },
          });

          // Check if there is already a pending audit suggestion for this transactionType + proposed target
          const existing = await prisma.accountMappingAudit.findFirst({
            where: {
              transactionType: tType,
              OR: [
                { suggestedAccountId: existingAccount?.id || "__none__" },
                { proposedAccountCode: pattern.targetAccountCode },
              ],
              status: "pending",
            },
          });

          const effectiveTxIds = allTxIds.length > 0 ? allTxIds.slice(0, 20) : [`system_pattern_${pattern.id}`];

          if (existing) {
            await prisma.accountMappingAudit.update({
              where: { id: existing.id },
              data: {
                confidenceScore: confidence,
                sourceTransactionIds: effectiveTxIds,
                suggestedAccountId: existingAccount?.id || null,
                proposedAccountCode: pattern.targetAccountCode,
                proposedAccountName: pattern.targetAccountName,
                proposedAccountType: pattern.targetAccountType,
                proposedParentCode: pattern.parentControlCode,
              },
            });
            updatedCount++;
          } else {
            await prisma.accountMappingAudit.create({
              data: {
                transactionType: tType,
                suggestedAccountId: existingAccount?.id || null,
                proposedAccountCode: pattern.targetAccountCode,
                proposedAccountName: pattern.targetAccountName,
                proposedAccountType: pattern.targetAccountType,
                proposedParentCode: pattern.parentControlCode,
                confidenceScore: confidence,
                sourceTransactionIds: effectiveTxIds,
                status: "pending",
              },
            });
            newCount++;
          }
        }
      }
    }

    const suggestions = await this.getSuggestions("pending", companyId);

    return {
      scannedCount: totalScanned,
      newSuggestionsCount: newCount,
      updatedCount,
      suggestions,
    };
  }

  /**
   * Retrieves audit suggestions joined with account details and current mapping info.
   */
  static async getSuggestions(
    status?: string,
    companyId: string = "DEFAULT"
  ): Promise<SuggestionResult[]> {
    const whereClause: any = {};
    if (status && status !== "ALL") {
      whereClause.status = status;
    }

    const audits = await prisma.accountMappingAudit.findMany({
      where: whereClause,
      include: {
        suggestedAccount: true,
      },
      orderBy: [{ status: "asc" }, { confidenceScore: "desc" }, { createdAt: "desc" }],
    });

    const currentMappings = await AccountMappingService.getAllMappings(companyId);
    const mappingMap = new Map<string, typeof currentMappings[0]>();
    for (const m of currentMappings) {
      mappingMap.set(m.transactionType, m);
    }

    const txDefMap = new Map<string, typeof TRANSACTION_TYPE_DEFINITIONS[0]>();
    for (const def of TRANSACTION_TYPE_DEFINITIONS) {
      txDefMap.set(def.transactionType, def);
    }

    return audits.map((audit) => {
      const current = mappingMap.get(audit.transactionType);
      const def = txDefMap.get(audit.transactionType);

      const suggestedAccountCode = audit.suggestedAccount?.code || audit.proposedAccountCode || "PROPOSED";
      const suggestedAccountName = audit.suggestedAccount?.name || audit.proposedAccountName || "Proposed Account";
      const suggestedAccountType = audit.suggestedAccount?.type || audit.proposedAccountType || "expense";

      // Find matching pattern for rationale
      const matchingPattern = KNOWN_PATTERNS.find(
        (p) =>
          p.targetAccountCode === suggestedAccountCode &&
          p.applicableTransactionTypes.includes(audit.transactionType)
      );

      const confidenceScore = audit.confidenceScore;
      let confidenceLevel: "HIGH" | "MEDIUM" | "LOW" = "LOW";
      if (confidenceScore >= 0.85) confidenceLevel = "HIGH";
      else if (confidenceScore >= 0.7) confidenceLevel = "MEDIUM";

      let rationale = "";
      if (matchingPattern) {
        rationale = matchingPattern.explanationTemplate(
          audit.sourceTransactionIds.length,
          0,
          matchingPattern.keywords
        );
      } else {
        rationale = `Proposed remapping for ${def?.name || audit.transactionType} to ${suggestedAccountName} (${suggestedAccountCode}).`;
      }

      return {
        id: audit.id,
        transactionType: audit.transactionType,
        transactionTypeName: def?.name || audit.transactionType,
        domain: def?.domain || "General",
        currentAccountId: current?.accountId || null,
        currentAccountCode: current?.accountCode || null,
        currentAccountName: current?.accountName || null,
        suggestedAccountId: audit.suggestedAccountId || `proposed_${audit.proposedAccountCode}`,
        suggestedAccountCode,
        suggestedAccountName,
        suggestedAccountType,
        confidenceScore: audit.confidenceScore,
        confidencePercentage: Math.round(audit.confidenceScore * 100),
        confidenceLevel,
        rationale,
        sourceTransactionIds: audit.sourceTransactionIds,
        sampleDescriptions: matchingPattern?.keywords.slice(0, 4) || [],
        totalAmountSampled: 0,
        status: audit.status,
        reviewedBy: audit.reviewedBy,
        reviewedAt: audit.reviewedAt,
        createdAt: audit.createdAt,
      };
    });
  }

  /**
   * Accepts a suggestion:
   * 1. Updates AccountMapping to point to suggested (or override) account
   * 2. Marks audit as 'accepted'
   */
  static async acceptSuggestion(
    auditId: string,
    reviewedBy: string = "Admin",
    overrideAccountId?: string,
    companyId: string = "DEFAULT"
  ): Promise<{ success: boolean; audit: AccountMappingAudit; mapping: any }> {
    const audit = await prisma.accountMappingAudit.findUnique({
      where: { id: auditId },
      include: { suggestedAccount: true },
    });

    if (!audit) {
      throw new Error(`Suggestion audit with ID ${auditId} not found`);
    }

    let finalAccountId = overrideAccountId || audit.suggestedAccountId;

    // If proposed account does not exist in DB yet, create it NOW upon admin approval!
    if ((!finalAccountId || finalAccountId.startsWith("proposed_")) && audit.proposedAccountCode && audit.proposedAccountName) {
      const createdAccount = await this.ensureAccountExists(
        audit.proposedAccountCode,
        audit.proposedAccountName,
        audit.proposedAccountType || "expense",
        audit.proposedParentCode || "6120-CTRL",
        companyId
      );
      finalAccountId = createdAccount.id;
    }

    if (!finalAccountId || finalAccountId.startsWith("proposed_")) {
      throw new Error(`Unable to resolve account for suggestion ${auditId}`);
    }

    // 1. Update the live AccountMapping
    const updatedMapping = await AccountMappingService.setMapping(
      companyId,
      audit.transactionType,
      finalAccountId,
      null,
      reviewedBy
    );

    // 2. Mark audit accepted
    const updatedAudit = await prisma.accountMappingAudit.update({
      where: { id: auditId },
      data: {
        status: "accepted",
        suggestedAccountId: finalAccountId,
        reviewedBy,
        reviewedAt: new Date(),
      },
    });

    return {
      success: true,
      audit: updatedAudit,
      mapping: updatedMapping,
    };
  }

  /**
   * Skips a suggestion without changing the mapping.
   */
  static async skipSuggestion(
    auditId: string,
    reviewedBy: string = "Admin"
  ): Promise<AccountMappingAudit> {
    return prisma.accountMappingAudit.update({
      where: { id: auditId },
      data: {
        status: "skipped",
        reviewedBy,
        reviewedAt: new Date(),
      },
    });
  }

  /**
   * Rejects a suggestion without changing the mapping.
   */
  static async rejectSuggestion(
    auditId: string,
    reviewedBy: string = "Admin"
  ): Promise<AccountMappingAudit> {
    return prisma.accountMappingAudit.update({
      where: { id: auditId },
      data: {
        status: "rejected",
        reviewedBy,
        reviewedAt: new Date(),
      },
    });
  }

  /**
   * Batch accepts all pending suggestions with confidence >= threshold (default: 0.85).
   */
  static async acceptAllHighConfidence(
    companyId: string = "DEFAULT",
    reviewedBy: string = "Admin",
    threshold: number = 0.85
  ): Promise<{ acceptedCount: number; results: any[] }> {
    const eligible = await prisma.accountMappingAudit.findMany({
      where: {
        status: "pending",
        confidenceScore: { gte: threshold },
      },
    });

    const results = [];
    for (const item of eligible) {
      const res = await this.acceptSuggestion(item.id, reviewedBy, undefined, companyId);
      results.push(res);
    }

    return {
      acceptedCount: results.length,
      results,
    };
  }
}
