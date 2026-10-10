"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) return setError("The new passwords do not match.");
    setSaving(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not change your password.");
      window.location.assign("/dashboards");
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
        <form onSubmit={submit} className="mt-6 space-y-4">
          {[
            ["Current temporary password", currentPassword, setCurrentPassword, "current-password"],
            ["New password", newPassword, setNewPassword, "new-password"],
            ["Confirm new password", confirmPassword, setConfirmPassword, "new-password"],
          ].map(([label, value, setter, autocomplete]) => (
            <label key={String(label)} className="block text-xs font-bold text-slate-700">
              {String(label)}
              <input type="password" value={String(value)} onChange={(event) => (setter as (value: string) => void)(event.target.value)} autoComplete={String(autocomplete)} required className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm outline-none focus:border-[#0D7A5F] focus:ring-4 focus:ring-emerald-100" />
            </label>
          ))}
          <div className="rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-600">
            Use at least 10 characters with uppercase, lowercase, a number, and a special character.
          </div>
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
          <button disabled={saving} className="h-11 w-full rounded-xl bg-[#0D7A5F] text-sm font-bold text-white flex items-center justify-center gap-2 hover:bg-[#0A624C] disabled:opacity-60">
            {saving ? "Saving…" : <>Save password and continue <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5" /> Other sessions are signed out automatically.</p>
      </div>
    </main>
  );
}
