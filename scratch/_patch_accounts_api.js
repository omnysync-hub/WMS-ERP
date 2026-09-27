const fs = require("fs");

// ========== accounts route: improve bulk_import + apply_same_as ==========
{
  let s = fs.readFileSync("src/app/api/accounts/route.ts", "utf8");

  if (!s.includes('case "apply_same_as"')) {
    s = s.replace(
      '// 20. UPDATE ACCOUNT MAPPING\n      case "update_account_mapping": {',
      `// 20. UPDATE ACCOUNT MAPPING
      case "update_account_mapping": {`
    );
    // Insert apply_same_as after update_account_mapping case block ends
    s = s.replace(
      /case "update_account_mapping": \{[\s\S]*?return NextResponse\.json\(\{ success: true, mapping: updated \}\);\r?\n\s*\}/,
      (match) => match + `

      // 20.05 SAME-AS QUICK FILL
      case "apply_same_as": {
        const {
          sourceTransactionType,
          targetTransactionTypes,
          companyId = "DEFAULT",
          actorName = "Accountant",
        } = payload;
        if (!sourceTransactionType || !Array.isArray(targetTransactionTypes) || targetTransactionTypes.length === 0) {
          return NextResponse.json(
            { error: "sourceTransactionType and targetTransactionTypes[] are required" },
            { status: 400 }
          );
        }
        const result = await AccountMappingService.applySameAs(
          companyId,
          sourceTransactionType,
          targetTransactionTypes,
          actorName
        );
        return NextResponse.json({ success: true, ...result });
      }`
    );
  }

  // Replace bulk_import_accounts with richer validation
  const oldBulkStart = 'case "bulk_import_accounts": {';
  const idx = s.indexOf(oldBulkStart);
  if (idx >= 0 && !s.includes("parentCode") || (s.includes('case "bulk_import_accounts"') && !s.includes("VALID_ACCOUNT_TYPES"))) {
    // Find the case block end - next case or default
    const start = s.indexOf(oldBulkStart);
    const defaultIdx = s.indexOf("\n      default:", start);
    if (start >= 0 && defaultIdx > start) {
      const newBulk = `case "bulk_import_accounts": {
        const { accounts: importAccounts, companyId = "DEFAULT", replaceInactive = false } = payload;
        if (!Array.isArray(importAccounts) || importAccounts.length === 0) {
          return NextResponse.json({ error: "A valid array of accounts is required" }, { status: 400 });
        }

        const VALID_ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense", "contra_revenue"];
        const seenCodes = new Set<string>();
        const errors: string[] = [];
        let createdCount = 0;
        let updatedCount = 0;
        let deactivatedCount = 0;

        // Pre-validate uniqueness within the batch
        for (let i = 0; i < importAccounts.length; i++) {
          const item = importAccounts[i];
          const code = item?.code != null ? String(item.code).trim() : "";
          if (!code) {
            errors.push(\`Row \${i + 1}: code is required\`);
            continue;
          }
          if (seenCodes.has(code)) {
            errors.push(\`Row \${i + 1}: duplicate code "\${code}" in import file\`);
          }
          seenCodes.add(code);
          if (!item.name || !String(item.name).trim()) {
            errors.push(\`Row \${i + 1} (\${code}): name is required\`);
          }
          const type = item.type ? String(item.type).trim().toLowerCase() : "";
          if (!VALID_ACCOUNT_TYPES.includes(type)) {
            errors.push(\`Row \${i + 1} (\${code}): type must be one of \${VALID_ACCOUNT_TYPES.join(", ")}\`);
          }
        }
        if (errors.length) {
          return NextResponse.json({ error: "COA import validation failed", details: errors.slice(0, 25) }, { status: 400 });
        }

        // Resolve parentCode → parentId (parents may be in the same batch — two-pass)
        for (const item of importAccounts) {
          const code = String(item.code).trim();
          const type = String(item.type).trim().toLowerCase();
          const name = String(item.name).trim();
          const isActive =
            item.isActive === undefined || item.isActive === null
              ? true
              : String(item.isActive).toLowerCase() !== "false" && item.isActive !== false && item.isActive !== 0 && item.isActive !== "0";
          const level = item.level != null ? Number(item.level) : 4;
          let parentId: string | null = item.parentId || null;

          if (item.parentCode) {
            const parent = await prisma.account.findUnique({ where: { code: String(item.parentCode).trim() } });
            if (!parent) {
              // Parent may be created earlier in this loop — look up again after creates
              const pendingParent = await prisma.account.findUnique({ where: { code: String(item.parentCode).trim() } });
              if (pendingParent) parentId = pendingParent.id;
              else {
                errors.push(\`Account \${code}: parentCode "\${item.parentCode}" not found\`);
                continue;
              }
            } else {
              parentId = parent.id;
            }
          }

          const existing = await prisma.account.findUnique({ where: { code } });
          if (existing) {
            // Do not wipe historical posted accounts — only update metadata / active flag
            await prisma.account.update({
              where: { id: existing.id },
              data: {
                name,
                type,
                description: item.description || existing.description,
                level: Number.isFinite(level) ? level : existing.level,
                parentId: parentId !== undefined && parentId !== null ? parentId : existing.parentId,
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
                currency: item.currency || "PKR",
                isSystem: false,
                isActive,
              },
            });
            createdCount++;
          }
        }

        if (errors.length) {
          return NextResponse.json({
            success: true,
            createdCount,
            updatedCount,
            deactivatedCount,
            warnings: errors,
          });
        }

        return NextResponse.json({ success: true, createdCount, updatedCount, deactivatedCount });
      }

`;
      s = s.slice(0, start) + newBulk + s.slice(defaultIdx);
    }
  }

  fs.writeFileSync("src/app/api/accounts/route.ts", s);
  console.log("accounts route patched");
}
