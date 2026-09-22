"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Edit2, ShieldCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CoaModalAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  level: number;
  parentId?: string | null;
  parentCode?: string | null;
  isSystem: boolean;
  isActive: boolean;
  currency?: string;
  description?: string | null;
}

interface CoaAccountModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  accountToEdit?: CoaModalAccount | null;
  allAccounts: CoaModalAccount[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function CoaAccountModal({
  isOpen,
  mode,
  accountToEdit,
  allAccounts,
  onClose,
  onSuccess,
}: CoaAccountModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("expense");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (mode === "edit" && accountToEdit) {
      setCode(accountToEdit.code);
      setName(accountToEdit.name);
      setType(accountToEdit.type);
      setDescription(accountToEdit.description || "");
      setParentId(accountToEdit.parentId || "");
      setCurrency(accountToEdit.currency || "PKR");
    } else {
      setCode("");
      setName("");
      setType("expense");
      setDescription("");
      setParentId("");
      setCurrency("PKR");
    }
    setErrorMsg("");
  }, [mode, accountToEdit, isOpen]);

  if (!isOpen) return null;

  // Level 3 parents that match the selected type
  const parentOptions = allAccounts.filter(
    (a) => a.level === 3 && (type ? a.type === type : true)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Account name is required.");
      return;
    }

    if (mode === "create") {
      if (!code.trim()) {
        setErrorMsg("Account code is required.");
        return;
      }
      // Check for duplicate code in frontend
      if (allAccounts.some((a) => a.code.toLowerCase() === code.trim().toLowerCase())) {
        setErrorMsg(`Account code "${code.trim()}" is already in use. Please enter a unique code.`);
        return;
      }
    }

    setIsSubmitting(true);

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
            description: description.trim() || null,
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

        onSuccess(`Account ${code.trim()} — ${name.trim()} successfully created.`);
      } else if (mode === "edit" && accountToEdit) {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_account",
            id: accountToEdit.id,
            name: name.trim(),
            description: description.trim() || null,
            parentId: accountToEdit.isSystem ? undefined : parentId || null,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to update account");
        }

        onSuccess(`Account ${accountToEdit.code} successfully updated.`);
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E4E4E7] text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#0D7A5F] flex items-center justify-center font-bold">
              {mode === "create" ? <Plus className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#18181B]">
                {mode === "create" ? "Add New Level 4 Account" : `Edit Account: ${accountToEdit?.code}`}
              </h3>
              <p className="text-[11px] text-[#71717A]">
                {mode === "create"
                  ? "Define a new posting-ready leaf account in the Chart of Accounts hierarchy."
                  : "Modify account title, operational description, or reporting parent."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#71717A] hover:text-[#18181B] rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 mt-3">
          {/* Account Code & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-[#18181B] block mb-1">
                Account Code * {mode === "edit" && "(Read-only)"}
              </label>
              <input
                type="text"
                disabled={mode === "edit"}
                placeholder="e.g. 6140"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9A-Za-z_-]/g, ""))}
                className={cn(
                  "w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] font-mono font-bold text-xs focus:bg-white focus:border-[#0D7A5F] focus:outline-none",
                  mode === "edit" && "opacity-60 cursor-not-allowed"
                )}
                required
              />
            </div>

            <div>
              <label className="font-semibold text-[#18181B] block mb-1">Classification *</label>
              <select
                disabled={mode === "edit"}
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setParentId("");
                }}
                className={cn(
                  "w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] font-semibold text-xs focus:bg-white focus:border-[#0D7A5F] focus:outline-none capitalize",
                  mode === "edit" && "opacity-60 cursor-not-allowed"
                )}
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
                <option value="contra_revenue">Contra Revenue</option>
              </select>
            </div>
          </div>

          {/* Account Title */}
          <div>
            <label className="font-semibold text-[#18181B] block mb-1">Account Title / Name *</label>
            <input
              type="text"
              placeholder="e.g. Technician Workshop Tools & Fasteners"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] text-xs font-medium focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
              required
            />
          </div>

          {/* Parent Control Account (Level 3) */}
          <div>
            <label className="font-semibold text-[#18181B] block mb-1">
              Parent Control Account (Level 3)
              {accountToEdit?.isSystem && " — Locked for System Accounts"}
            </label>
            <select
              disabled={accountToEdit?.isSystem}
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={cn(
                "w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] text-xs font-medium focus:bg-white focus:border-[#0D7A5F] focus:outline-none",
                accountToEdit?.isSystem && "opacity-60 cursor-not-allowed"
              )}
            >
              <option value="">No explicit parent (Rolls up to category root)</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name} ({p.type})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[#71717A] mt-1">
              Level is automatically set to Level 4 (Transactional leaf account).
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="font-semibold text-[#18181B] block mb-1">Description & Purpose</label>
            <textarea
              rows={2}
              placeholder="Describe standard posting triggers and audit purpose..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] text-xs focus:bg-white focus:border-[#0D7A5F] focus:outline-none"
            />
          </div>

          {/* Currency (Read-only PKR for standard) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-[#18181B] block mb-1">Currency</label>
              <input
                type="text"
                disabled
                value={currency}
                className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] text-xs font-mono font-bold opacity-60 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="font-semibold text-[#18181B] block mb-1">Posting Level</label>
              <input
                type="text"
                disabled
                value="Level 4 (Transactional)"
                className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#EDEDED] text-xs font-semibold opacity-60 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E4E7]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-[#71717A] hover:text-[#18181B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving..."
                : mode === "create"
                ? "Create Account"
                : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
