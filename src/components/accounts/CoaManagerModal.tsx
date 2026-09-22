"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  Edit2,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  FolderTree,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CoaAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  level: number;
  parentId?: string | null;
  isSystem: boolean;
  isActive: boolean;
  currency?: string;
  description?: string | null;
}

interface CoaManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: "create" | "edit" | "import";
  accountToEdit?: CoaAccount | null;
  allAccounts: CoaAccount[];
}

export default function CoaManagerModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  accountToEdit,
  allAccounts,
}: CoaManagerModalProps) {
  if (!isOpen) return null;

  // Form states: Create / Edit
  const [code, setCode] = useState(accountToEdit?.code || "");
  const [name, setName] = useState(accountToEdit?.name || "");
  const [type, setType] = useState(accountToEdit?.type || "asset");
  const [description, setDescription] = useState(accountToEdit?.description || "");
  const [parentId, setParentId] = useState<string>(accountToEdit?.parentId || "");
  const [isActive, setIsActive] = useState<boolean>(
    accountToEdit ? accountToEdit.isActive : true
  );
  const [currency, setCurrency] = useState(accountToEdit?.currency || "PKR");

  // Form state: CSV Import
  const [csvContent, setCsvContent] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Filter possible Level 3 parent accounts
  const parentOptions = allAccounts.filter((a) => a.level === 3);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      if (mode === "create") {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_account",
            code: code.trim(),
            name: name.trim(),
            type,
            description: description.trim(),
            parentId: parentId || null,
            level: 4,
            currency,
            companyId: "DEFAULT",
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to create account");
        }
      } else if (mode === "edit" && accountToEdit) {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_account",
            id: accountToEdit.id,
            name: name.trim(),
            description: description.trim(),
            isActive,
            parentId: parentId || null,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to update account");
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCsvImport = async () => {
    if (!csvContent.trim()) {
      setErrorMsg("Please paste or upload CSV text.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const lines = csvContent.trim().split("\n");
      const rows: Array<{
        code: string;
        name: string;
        type: string;
        description?: string;
        level?: number;
      }> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || i === 0 && line.toLowerCase().includes("code")) continue; // Skip header
        const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
        if (parts.length >= 3) {
          rows.push({
            code: parts[0],
            name: parts[1],
            type: parts[2].toLowerCase(),
            description: parts[3] || undefined,
            level: parts[4] ? Number(parts[4]) : 4,
          });
        }
      }

      if (rows.length === 0) {
        throw new Error("No valid account rows found in CSV. Expected columns: code, name, type, [description], [level]");
      }

      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk_import_accounts",
          accounts: rows,
          companyId: "DEFAULT",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to import accounts");
      }

      setImportStatus(`Imported ${data.createdCount} new accounts, updated ${data.updatedCount} accounts.`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E4E4E7] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 bg-[#F4F4F5] border-b border-[#E4E4E7] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#0D7A5F] flex items-center justify-center">
              {mode === "create" && <Plus className="w-4 h-4" />}
              {mode === "edit" && <Edit2 className="w-4 h-4" />}
              {mode === "import" && <Upload className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#18181B]">
                {mode === "create" && "Add New Chart of Account Ledger"}
                {mode === "edit" && `Edit Account: ${accountToEdit?.code}`}
                {mode === "import" && "Bulk CSV Import — Chart of Accounts"}
              </h3>
              <p className="text-[11px] text-[#71717A]">
                {mode === "create" && "Create a new Level 4 posting ledger linked to a Level 3 parent."}
                {mode === "edit" && "Modify account details, reparent hierarchy node, or change active status."}
                {mode === "import" && "Upload or paste batch accounts in CSV format (code, name, type, description)."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#71717A] hover:text-[#18181B] rounded-lg hover:bg-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error / Status message */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}
        {importStatus && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-[#065F46] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {importStatus}
          </div>
        )}

        {/* Mode: Create or Edit */}
        {mode !== "import" ? (
          <form onSubmit={handleSaveAccount} className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-[#18181B] mb-1">
                  Account Code *
                </label>
                <input
                  type="text"
                  required
                  disabled={mode === "edit"} // Code is immutable in edit
                  placeholder="e.g. 6205"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-[#F4F4F5] disabled:bg-[#EDEDED] px-3 py-2 rounded-lg border border-[#EDEDED] font-mono text-xs font-bold text-[#18181B] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#18181B] mb-1">
                  Classification / Type *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  disabled={mode === "edit" && accountToEdit?.isSystem}
                  className="w-full bg-[#F4F4F5] px-3 py-2 rounded-lg border border-[#EDEDED] text-xs font-medium text-[#18181B] focus:bg-white focus:outline-none"
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expense</option>
                  <option value="contra_revenue">Contra-Revenue</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#18181B] mb-1">
                Account Title / Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Fuel & Fleet Maintenance"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#F4F4F5] px-3 py-2 rounded-lg border border-[#EDEDED] text-xs font-medium text-[#18181B] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#18181B] mb-1">
                Parent Hierarchy Node (Level 3 Control Group)
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full bg-[#F4F4F5] px-3 py-2 rounded-lg border border-[#EDEDED] text-xs font-medium text-[#18181B] focus:bg-white focus:outline-none"
              >
                <option value="">-- Direct Root / Unassigned --</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name} ({p.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#18181B] mb-1">
                Description / Memo (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Operational purpose of this ledger..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#F4F4F5] px-3 py-2 rounded-lg border border-[#EDEDED] text-xs font-medium text-[#18181B] focus:bg-white focus:outline-none"
              />
            </div>

            {mode === "edit" && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F4F4F5] border border-[#EDEDED]">
                <div>
                  <span className="text-xs font-bold text-[#18181B] block">Active Status</span>
                  <span className="text-[10px] text-[#71717A]">
                    Deactivated accounts cannot receive journal postings.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-[#0D7A5F]"
                />
              </div>
            )}

            {accountToEdit?.isSystem && (
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>System Protected Account:</strong> This is a core ledger account. You may rename it or adjust its description, but it cannot be deleted.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-[#EDEDED] text-xs font-semibold hover:bg-[#F4F4F5] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : mode === "create" ? "Create Account" : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          /* Mode: CSV Import */
          <div className="p-6 space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-[#18181B] mb-1">
                Paste CSV Rows (or sample format)
              </label>
              <p className="text-[10px] text-[#71717A] mb-2 font-mono">
                Format: code,name,type,description,level
              </p>
              <textarea
                rows={8}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder={`code,name,type,description,level\n6205,Workshop Electrical Tools,expense,Workshop hand tools and consumables,4\n6210,Branch Office Rent,expense,Monthly facility rental expense,4\n1300,Prepaid Facility Rent,asset,Prepaid rent advance balance,4`}
                className="w-full bg-[#F4F4F5] px-3 py-2 rounded-lg border border-[#EDEDED] font-mono text-xs text-[#18181B] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E4E4E7]">
              <button
                type="button"
                onClick={() =>
                  setCsvContent(
                    `code,name,type,description,level\n6205,Workshop Electrical Tools,expense,Workshop hand tools and consumables,4\n6210,Branch Office Rent,expense,Monthly facility rental expense,4\n1300,Prepaid Facility Rent,asset,Prepaid rent advance balance,4`
                  )
                }
                className="text-[11px] text-[#0D7A5F] font-bold hover:underline"
              >
                Load Sample Template
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-[#EDEDED] text-xs font-semibold hover:bg-[#F4F4F5] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCsvImport}
                  disabled={isSubmitting || !csvContent.trim()}
                  className="px-4 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Importing..." : "Execute Bulk Import"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
