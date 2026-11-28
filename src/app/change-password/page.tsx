"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Check, KeyRound, ShieldCheck } from "lucide-react";
import PasswordField from "@/components/ui/PasswordField";
import { FieldErrorText } from "@/components/ui/form";
import { passwordSatisfiesPolicy } from "@/lib/passwordRules";
import { cn } from "@/lib/utils";

const INPUT_CLS =
  "mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm outline-none focus:border-[#0D7A5F] focus:ring-4 focus:ring-emerald-100 bg-white";
const LABEL_CLS = "block text-xs font-bold text-slate-700";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const newPasswordValid = passwordSatisfiesPolicy("web", newPassword);
  const bothFilled = newPassword.length > 0 && confirmPassword.length > 0;
  const passwordsMatch = newPassword === confirmPassword;
  const canSave =
    currentPassword.length > 0 && newPasswordValid && bothFilled && passwordsMatch;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitAttempted(true);
    setError("");
    if (!canSave) return;
    setSaving(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not change your password.");
      const userRole = (data.user?.role || "").toLowerCase();
      const defaultLanding =
        userRole === "admin"
          ? "/dashboards"
          : userRole === "hr"
          ? "/hrm"
          : userRole === "storekeeper"
          ? "/inventory"
          : "/jobs";
      window.location.assign(defaultLanding);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change your password.");
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1714] px-5 py-12 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 text-[#18181b] shadow-2xl sm:p-9">
        <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-[#0D7A5F] flex items-center justify-center"><KeyRound className="h-6 w-6" /></div>
        <h1 className="mt-5 text-2xl font-black tracking-tight">Create your private password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Your temporary password worked. Replace it before opening the ERP.</p>
        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <div data-field-invalid={submitAttempted && !currentPassword ? "true" : undefined}>
            <label htmlFor="current-password" className={LABEL_CLS}>
              Current temporary password <span className="text-rose-500">*</span>
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              className={cn(INPUT_CLS, submitAttempted && !currentPassword && "border-rose-400 focus:border-rose-500 focus:ring-rose-100")}
            />
            {submitAttempted && !currentPassword && (
              <FieldErrorText>Enter your current temporary password.</FieldErrorText>
            )}
          </div>

          <PasswordField
            id="new-password"
            label="New password"
            required
            policy="web"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            submitAttempted={submitAttempted}
            labelClassName={LABEL_CLS}
            inputClassName="h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm outline-none focus:border-[#0D7A5F] focus:ring-4 focus:ring-emerald-100 bg-white"
          />

          <div data-field-invalid={submitAttempted && (!confirmPassword || (bothFilled && !passwordsMatch)) ? "true" : undefined}>
            <label htmlFor="confirm-password" className={LABEL_CLS}>
              Confirm new password <span className="text-rose-500">*</span>
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              className={cn(
                INPUT_CLS,
                bothFilled && !passwordsMatch && "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
              )}
            />
            {bothFilled && passwordsMatch && (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700 animate-in fade-in">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Passwords match</span>
              </p>
            )}
            {bothFilled && !passwordsMatch && (
              <FieldErrorText>Passwords do not match yet.</FieldErrorText>
            )}
            {submitAttempted && !confirmPassword && (
              <FieldErrorText>Re-enter the new password to confirm it.</FieldErrorText>
            )}
          </div>

          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
          <button disabled={saving || !canSave} className="h-11 w-full rounded-xl bg-[#0D7A5F] text-sm font-bold text-white flex items-center justify-center gap-2 hover:bg-[#0A624C] disabled:opacity-60">
            {saving ? "Saving…" : <>Save password and continue <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5" /> Other sessions are signed out automatically.</p>
      </div>
    </main>
  );
}
