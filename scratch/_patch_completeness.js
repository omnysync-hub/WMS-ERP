const fs = require("fs");
let s = fs.readFileSync("src/lib/services/AccountMappingService.ts", "utf8");

const marker = "  /**\n   * Returns mapping completeness summary";
const markerCR = "  /**\r\n   * Returns mapping completeness summary";
const idx = s.includes(marker) ? s.indexOf(marker) : s.indexOf(markerCR);
if (idx < 0) { console.error("marker not found"); process.exit(1); }

const head = s.slice(0, idx);
const newTail = `  /**
   * Returns mapping completeness summary (mapped to active leaf accounts).
   */
  static async getCompleteness(companyId: string = "DEFAULT") {
    const mappings = await this.getAllMappings(companyId);
    const total = mappings.length;

    const accountIds = mappings.map((m) => m.accountId).filter((id): id is string => !!id);
    const accounts = accountIds.length
      ? await prisma.account.findMany({ where: { id: { in: accountIds } } })
      : [];
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const fullyValid = mappings.filter((m) => {
      if (!m.accountId) return false;
      const acc = accountMap.get(m.accountId);
      if (!acc) return false;
      if (!acc.isActive) return false;
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
        return !!acc && (!acc.isActive || acc.level < 4);
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
}
`;

fs.writeFileSync("src/lib/services/AccountMappingService.ts", head + newTail, "utf8");
console.log("getCompleteness + applySameAs replaced, len=", (head + newTail).length);
