const fs = require("fs");
let s = fs.readFileSync("src/components/accounts/AccountMappingTab.tsx", "utf8");

// 1. Extend props
s = s.replace(
  `interface AccountMappingTabProps {
  initialSubTab?: "mappings" | "suggestions";
  targetTransactionType?: string;
}

export default function AccountMappingTab({
  initialSubTab = "mappings",
  targetTransactionType = "",
}: AccountMappingTabProps = {}) {`,
  `interface AccountMappingTabProps {
  initialSubTab?: "mappings" | "suggestions";
  targetTransactionType?: string;
  /** Compact layout for embedding inside the /setup wizard */
  setupMode?: boolean;
  /** Fired whenever completeness summary changes (setup gate) */
  onCompletenessChange?: (summary: CompletenessSummary | null) => void;
}

/** Preset "same as" groups for cash / bank quick-fill during onboarding */
const SAME_AS_GROUPS: Array<{ id: string; label: string; source: string; targets: string[] }> = [
  {
    id: "cash_vault",
    label: "Cash / Vault receiving & disbursing",
    source: "customer_payment_receiving",
    targets: [
      "customer_payment_receiving",
      "pos_sale_cash",
      "settlement_collection_vault",
      "expense_reimbursement_disbursing",
      "advance_granted_disbursing",
      "payroll_net_disbursing",
      "stock_in_disbursing",
      "tech_expense_settlement_vault",
    ],
  },
  {
    id: "bank_ops",
    label: "Operating bank (receipts & payments)",
    source: "bank_operating",
    targets: [
      "bank_operating",
      "vendor_payment_disbursing",
      "pos_sale_bank",
    ],
  },
  {
    id: "ar_control",
    label: "Accounts receivable control",
    source: "ar_control",
    targets: [
      "ar_control",
      "job_revenue_receivable",
      "customer_payment_receivable",
      "pos_sale_receivable",
      "settlement_collection_receivable",
    ],
  },
  {
    id: "ap_control",
    label: "Accounts payable control",
    source: "ap_control",
    targets: [
      "ap_control",
      "vendor_bill_payable",
      "grn_receipt_payable",
      "vendor_payment_payable",
    ],
  },
];

export default function AccountMappingTab({
  initialSubTab = "mappings",
  targetTransactionType = "",
  setupMode = false,
  onCompletenessChange,
}: AccountMappingTabProps = {}) {`
);

// 2. Notify parent when completeness changes
if (!s.includes("onCompletenessChange?.(")) {
  s = s.replace(
    /setCompleteness\(mappingData\.completeness \|\| null\);/,
    `const nextCompleteness = mappingData.completeness || null;
      setCompleteness(nextCompleteness);
      onCompletenessChange?.(nextCompleteness);`
  );
}

// 3. Add applyingSameAs state + handler after savingKey state
if (!s.includes("applyingSameAs")) {
  s = s.replace(
    `const [savingKey, setSavingKey] = useState<string | null>(null);`,
    `const [savingKey, setSavingKey] = useState<string | null>(null);
  const [applyingSameAs, setApplyingSameAs] = useState<string | null>(null);`
  );
}

if (!s.includes("handleApplySameAs")) {
  s = s.replace(
    `const handleScanTransactions = async () => {`,
    `const handleApplySameAs = async (groupId: string) => {
    const group = SAME_AS_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    setApplyingSameAs(groupId);
    setErrorToast(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply_same_as",
          sourceTransactionType: group.source,
          targetTransactionTypes: group.targets,
          companyId: "DEFAULT",
          actorName: "Setup Wizard",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to apply same-as fill");
      }
      await loadData();
      setSuccessToast(\`Applied "\${group.label}" to \${data.updated} transaction types (from \${data.accountCode}).\`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      setErrorToast(err.message || "Same-as fill failed");
      setTimeout(() => setErrorToast(null), 5000);
    } finally {
      setApplyingSameAs(null);
    }
  };

  const handleScanTransactions = async () => {`
  );
}

// 4. Insert Same-As UI before Completeness Diagnostic or after completeness pill
if (!s.includes("Same-as quick-fill")) {
  const marker = `{/* Completeness Diagnostic Card */}`;
  const idx = s.indexOf(marker);
  if (idx >= 0) {
    const panel = `{/* Same-as quick-fill for cash/bank/control groups */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-[#18181B] uppercase tracking-wider">Same-as quick-fill</h3>
            <p className="text-[11px] text-[#71717A] mt-0.5">
              Copy one mapped leaf account across related cash, bank, AR, or AP slots. Source mapping must already be set.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {SAME_AS_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              disabled={!!applyingSameAs}
              onClick={() => handleApplySameAs(g.id)}
              className="text-left p-3 rounded-xl border border-[#E4E4E7] hover:border-[#0D7A5F] hover:bg-emerald-50/40 transition text-xs disabled:opacity-50"
            >
              <span className="font-bold text-[#18181B] block">{g.label}</span>
              <span className="text-[10px] text-[#71717A] font-mono">
                {applyingSameAs === g.id ? "Applying…" : \`Source: \${g.source} → \${g.targets.length} slots\`}
              </span>
            </button>
          ))}
        </div>
      </div>

      `;
    s = s.slice(0, idx) + panel + s.slice(idx);
  }
}

// 5. Hide suggestions sub-tab chrome slightly in setupMode - optional via class on wrapper
// Add useEffect for onCompletenessChange when completeness state updates
if (!s.includes("useEffect(() => {\n    onCompletenessChange?.(completeness);")) {
  // after loadData useEffect is fine - add a small effect
  s = s.replace(
    /useEffect\(\(\) => \{\r?\n\s*loadData\(\);\r?\n\s*\}, \[\]\);/,
    `useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    onCompletenessChange?.(completeness);
  }, [completeness]);`
  );
}

fs.writeFileSync("src/components/accounts/AccountMappingTab.tsx", s);
console.log("AccountMappingTab patched, len=", s.length);
