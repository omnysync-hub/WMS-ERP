"use client";

import React, { useState, useEffect } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { Phone, CheckCircle2, Loader2 } from "lucide-react";
import { notify } from "@/lib/notify";

const SETTING_KEY = "storekeeper_phone";

export default function StorekeeperContactPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/app-settings", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const value = data?.settings?.[SETTING_KEY];
        if (typeof value === "string") setPhone(value);
      } catch {
        // Leave empty — saving still works and reports errors properly.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/app-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: SETTING_KEY, value: phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save the number.");
      setSaved(true);
      notify.success(
        phone.trim()
          ? "Storekeeper number saved — technicians will see a Call Storekeeper button."
          : "Storekeeper number cleared — the Call Storekeeper button is hidden in the app."
      );
    } catch (err: any) {
      notify.error(err.message || "Could not save the number.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storekeeper Contact"
        subtitle="The number technicians tap in the mobile app to call the storekeeper."
      />

      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-6 max-w-xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0D7A5F]/10 flex items-center justify-center shrink-0">
            <Phone className="w-5 h-5 text-[#0D7A5F]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#18181B]">Call Storekeeper number</h3>
            <p className="text-xs text-[#71717A] mt-1 leading-relaxed">
              Shown as a &ldquo;Call Storekeeper&rdquo; button on job screens in the technician
              app. Leave it empty to hide the button. Changes reach phones the next time a
              technician signs in or the app refreshes their profile — no app update needed.
            </p>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-[#18181B] block mb-1.5 uppercase tracking-wide">
            Phone number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 0300 1234567"
            disabled={loading}
            className="w-full bg-[#F4F4F5] p-2.5 rounded-lg border border-[#D4D4D8] text-sm focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] disabled:bg-[#D4D4D8] text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {saving ? "Saving…" : "Save number"}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
