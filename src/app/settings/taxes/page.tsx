"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { Percent, Plus, Trash2, Save, AlertCircle, CheckCircle2, Users, FileBarChart } from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import {
  DEFAULT_TAX_POLICY,
  TAX_ACCOUNT_ROLES,
  TAX_KINDS,
  computeTax,
  findRate,
  normalizeTaxPolicy,
  type TaxPolicy,
  type TaxRateConfig,
} from "@/lib/tax/taxConfig";
import { formatCurrency } from "@/lib/utils";

const field = "h-8 px-2 rounded-lg border border-[#D4D4D8] bg-white text-xs w-full";
const newId = () => `tax-${Math.random().toString(36).slice(2, 9)}`;

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-2 text-xs ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" className="mt-0.5" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-semibold text-[#18181B]">{label}</span>
        {hint && <span className="block text-[11px] text-[#71717A]">{hint}</span>}
      </span>
    </label>
  );
}

function RateSelect({ value, onChange, rates, purpose, allowNone = true, disabled }: { value: string | null; onChange: (v: string | null) => void; rates: TaxRateConfig[]; purpose: "sales" | "purchases" | "wht"; allowNone?: boolean; disabled?: boolean }) {
  const options = rates.filter((r) =>
    purpose === "wht" ? r.type === "withholding" : r.type !== "withholding" && (r.appliesTo === "both" || r.appliesTo === purpose)
  );
  const codes = Array.from(new Set(options.map((r) => r.code)));
  return (
    <select className={field} value={value || ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      {allowNone && <option value="">— choose a rate —</option>}
      {codes.map((c) => {
        const r = findRate(rates, c) || options.find((o) => o.code === c)!;
        return (
          <option key={c} value={c}>
            {c} · {r.name} ({r.rate}%)
          </option>
        );
      })}
    </select>
  );
}

export default function TaxSettingsPage() {
  const { hasPermission } = useRole();
  const [rates, setRates] = useState<TaxRateConfig[]>([]);
  const [policy, setPolicy] = useState<TaxPolicy>(DEFAULT_TAX_POLICY);
  const [roleAccounts, setRoleAccounts] = useState<Record<string, { code: string; name: string } | null>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [newJobType, setNewJobType] = useState("");
  // Parties
  const [partyQuery, setPartyQuery] = useState("");
  const [parties, setParties] = useState<{ customers: any[]; vendors: any[] }>({ customers: [], vendors: [] });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/taxes", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tax settings");
      setRates(data.rates || []);
      setPolicy(normalizeTaxPolicy(data.policy));
      setRoleAccounts(data.roleAccounts || {});
      setCanEdit(Boolean(data.canEdit));
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setLoading(false);
    }
    try {
      const raw = localStorage.getItem("custom_job_types");
      const list = raw ? JSON.parse(raw) : [];
      setJobTypes(Array.isArray(list) ? list.map((x: any) => (typeof x === "string" ? x : x?.value || x?.name || x?.label)).filter(Boolean) : []);
    } catch {
      /* optional */
    }
  };
  useEffect(() => {
    load();
  }, []);

  const loadParties = async () => {
    const res = await fetch(`/api/settings/taxes/parties?q=${encodeURIComponent(partyQuery)}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setParties(data);
    else setMsg({ ok: false, text: data.error || "Failed to load customers/suppliers" });
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/taxes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rates, policy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setRates(data.rates);
      setPolicy(normalizeTaxPolicy(data.policy));
      setRoleAccounts(data.roleAccounts || {});
      setMsg({ ok: true, text: "Tax settings saved. New invoices, POS sales and bills use them from now on." });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const savePartyRow = async (partyType: "customer" | "vendor", row: any) => {
    const res = await fetch("/api/settings/taxes/parties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partyType, ...row }),
    });
    const data = await res.json();
    setMsg(res.ok ? { ok: true, text: `Saved tax details for ${row.name}.` } : { ok: false, text: data.error || "Save failed" });
  };

  const updateRate = (i: number, patch: Partial<TaxRateConfig>) => setRates((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const setJobs = (patch: Partial<TaxPolicy["jobs"]>) => setPolicy((p) => ({ ...p, jobs: { ...p.jobs, ...patch } }));
  const setPos = (patch: Partial<TaxPolicy["pos"]>) => setPolicy((p) => ({ ...p, pos: { ...p.pos, ...patch } }));
  const setProc = (patch: Partial<TaxPolicy["procurement"]>) => setPolicy((p) => ({ ...p, procurement: { ...p.procurement, ...patch } }));
  const setProj = (patch: Partial<TaxPolicy["projects"]>) => setPolicy((p) => ({ ...p, projects: { ...p.projects, ...patch } }));
  const setWht = (patch: Partial<TaxPolicy["wht"]>) => setPolicy((p) => ({ ...p, wht: { ...p.wht, ...patch } }));

  // Live example so users see exactly what a PKR 10,000 job with PKR 1,000 discount becomes.
  const example = useMemo(() => {
    const rate = findRate(rates, policy.jobs.rateCode);
    if (!policy.jobs.enabled || !rate) return null;
    return { rate, calc: computeTax({ gross: 10000, discount: 1000, ratePercent: rate.rate, inclusive: policy.jobs.pricesIncludeTax, applyAfterDiscount: policy.jobs.applyAfterDiscount, rounding: policy.rounding }) };
  }, [rates, policy]);

  const disabled = !canEdit || saving;
  if (!hasPermission("settings.taxes") && !hasPermission("settings.accounting")) {
    return (
      <div className="space-y-6">
        <PageHeader moduleName="Settings" currentView="Taxes" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">You do not have permission to manage tax settings.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader moduleName="Settings" currentView="Taxes" />

      <div className="bg-white border border-[#E4E4E7] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0D7A5F]/10 text-[#0D7A5F] flex items-center justify-center">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#18181B]">Taxes</h1>
            <p className="text-xs text-[#71717A]">Tax rates, and what happens on job invoices, POS, supplier bills, projects and payments. Changes apply to new documents only — invoices already raised keep their tax.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/accounts/tax-report" className="h-8 px-3 rounded-lg border border-[#E4E4E7] text-xs font-semibold inline-flex items-center gap-1.5">
            <FileBarChart className="w-3.5 h-3.5" /> Tax report
          </Link>
          <button type="button" onClick={save} disabled={disabled} className="h-8 px-4 rounded-lg bg-[#0D7A5F] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save tax settings"}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}
      {!canEdit && !loading && <div className="p-3 rounded-xl border bg-amber-50 border-amber-200 text-xs text-amber-900">Read-only: you can view tax settings but not change them.</div>}

      {/* 1. Rates */}
      <section className="bg-white border border-[#E4E4E7] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold">1. Tax rates</h2>
            <p className="text-[11px] text-[#71717A]">To change a rate from a date, add a second row with the same code and a later “effective from”.</p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setRates((p) => [...p, { id: newId(), name: "", code: "", type: "sales_tax", rate: 0, appliesTo: "sales", inclusive: false, isDefault: false, active: true, effectiveFrom: null, accountRole: "sales_tax_payable" }])}
            className="h-8 px-3 rounded-lg border border-[#E4E4E7] text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> Add rate
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase text-[#71717A] border-b">
                <th className="py-2 pr-2">Name</th>
                <th className="pr-2">Code</th>
                <th className="pr-2">Rate %</th>
                <th className="pr-2">Type</th>
                <th className="pr-2">Used on</th>
                <th className="pr-2">Effective from</th>
                <th className="pr-2">Posts to (account role)</th>
                <th className="pr-2">Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-[#71717A]">No tax rates yet. Add e.g. GST18 (18%), PRA16 (16%), WHT-S153 (4.5%).</td>
                </tr>
              )}
              {rates.map((r, i) => {
                const acc = r.accountRole ? roleAccounts[r.accountRole] : null;
                return (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="py-1.5 pr-2 min-w-[140px]"><input className={field} disabled={disabled} value={r.name} onChange={(e) => updateRate(i, { name: e.target.value })} placeholder="Punjab Sales Tax on Services" /></td>
                    <td className="pr-2 w-24"><input className={field} disabled={disabled} value={r.code} onChange={(e) => updateRate(i, { code: e.target.value.toUpperCase() })} placeholder="PRA16" /></td>
                    <td className="pr-2 w-20"><input className={field} disabled={disabled} type="number" step="0.01" min="0" max="100" value={r.rate} onChange={(e) => updateRate(i, { rate: Number(e.target.value) })} /></td>
                    <td className="pr-2 min-w-[150px]">
                      <select
                        className={field}
                        disabled={disabled}
                        value={r.type}
                        onChange={(e) => {
                          const k = TAX_KINDS.find((x) => x.value === e.target.value)!;
                          updateRate(i, { type: k.value, accountRole: k.defaultRole, appliesTo: k.appliesTo });
                        }}
                      >
                        {TAX_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                      </select>
                    </td>
                    <td className="pr-2 w-28">
                      <select className={field} disabled={disabled} value={r.appliesTo} onChange={(e) => updateRate(i, { appliesTo: e.target.value as any })}>
                        <option value="sales">Sales</option>
                        <option value="purchases">Purchases</option>
                        <option value="both">Both</option>
                      </select>
                    </td>
                    <td className="pr-2 w-32"><input className={field} disabled={disabled} type="date" value={r.effectiveFrom || ""} onChange={(e) => updateRate(i, { effectiveFrom: e.target.value || null })} /></td>
                    <td className="pr-2 min-w-[190px]">
                      <select className={field} disabled={disabled} value={r.accountRole || ""} onChange={(e) => updateRate(i, { accountRole: e.target.value as any })}>
                        {TAX_ACCOUNT_ROLES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                      </select>
                      <span className={`block text-[10px] mt-0.5 ${acc ? "text-[#71717A]" : "text-rose-700"}`}>
                        {acc ? `→ ${acc.code} ${acc.name}` : "Not mapped yet (Accounts › Account Mapping)"}
                      </span>
                    </td>
                    <td className="pr-2 w-14 text-center pt-2"><input type="checkbox" disabled={disabled} checked={r.active} onChange={(e) => updateRate(i, { active: e.target.checked })} /></td>
                    <td className="pt-1.5"><button type="button" disabled={disabled} onClick={() => setRates((p) => p.filter((_, idx) => idx !== i))} className="p-1.5 text-rose-600 disabled:opacity-40" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 2. Jobs */}
        <section className="bg-white border border-[#E4E4E7] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold">2. Job invoices</h2>
          <Toggle disabled={disabled} checked={policy.jobs.enabled} onChange={(v) => setJobs({ enabled: v })} label="Charge tax on job invoices" hint="Off = jobs are invoiced without tax (how it worked before)." />
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-[11px] text-[#71717A]">Default rate</span><RateSelect disabled={disabled} value={policy.jobs.rateCode} onChange={(v) => setJobs({ rateCode: v })} rates={rates} purpose="sales" /></div>
            <div>
              <span className="text-[11px] text-[#71717A]">Job prices are</span>
              <select className={field} disabled={disabled} value={policy.jobs.pricesIncludeTax ? "inc" : "exc"} onChange={(e) => setJobs({ pricesIncludeTax: e.target.value === "inc" })}>
                <option value="exc">Before tax (tax added on top)</option>
                <option value="inc">Tax-inclusive (tax is inside the price)</option>
              </select>
            </div>
          </div>
          <Toggle disabled={disabled} checked={policy.jobs.applyAfterDiscount} onChange={(v) => setJobs({ applyAfterDiscount: v })} label="Work out tax after the discount" hint="Off = tax on the full price before discount." />
          <Toggle disabled={disabled} checked={policy.jobs.taxCareOfJobs} onChange={(v) => setJobs({ taxCareOfJobs: v })} label="Tax care-of (company-referred) jobs that the customer pays" />
          <Toggle disabled={disabled} checked={policy.jobs.taxFocPayments} onChange={(v) => setJobs({ taxFocPayments: v })} label="FOC jobs: the referring company's payment includes tax" hint="The FOC customer is never charged. When on, the company payment is split into revenue + sales tax." />
          <div className="border-t pt-2 space-y-1.5">
            <span className="text-[11px] font-semibold text-[#18181B]">Different rate or exempt for a job type</span>
            {Object.entries(policy.jobs.byJobType).map(([jt, c]) => (
              <div key={jt} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <span className="text-xs">{jt}</span>
                <select className={field} disabled={disabled} value={c} onChange={(e) => setJobs({ byJobType: { ...policy.jobs.byJobType, [jt]: e.target.value } })}>
                  <option value="exempt">Exempt (no tax)</option>
                  {Array.from(new Set(rates.filter((r) => r.type !== "withholding").map((r) => r.code))).map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
                <button type="button" disabled={disabled} className="p-1 text-rose-600" onClick={() => { const n = { ...policy.jobs.byJobType }; delete n[jt]; setJobs({ byJobType: n }); }}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input list="tax-job-types" className={field} disabled={disabled} value={newJobType} onChange={(e) => setNewJobType(e.target.value)} placeholder="Job type, e.g. Installation" />
              <datalist id="tax-job-types">{jobTypes.map((t) => <option key={t} value={t} />)}</datalist>
              <button type="button" disabled={disabled || !newJobType.trim()} className="h-8 px-3 rounded-lg border text-xs font-semibold" onClick={() => { setJobs({ byJobType: { ...policy.jobs.byJobType, [newJobType.trim()]: "exempt" } }); setNewJobType(""); }}>Add</button>
            </div>
          </div>
          {example && (
            <div className="p-2.5 rounded-lg bg-[#F4F4F5] text-[11px] text-[#3F3F46]">
              Example: job PKR 10,000 with PKR 1,000 discount → tax {formatCurrency(example.calc.tax)} ({example.rate.code} {example.rate.rate}%), customer pays <b>{formatCurrency(example.calc.total)}</b>. Posting: Dr Receivable {formatCurrency(example.calc.total)}, Dr Discount {formatCurrency(1000)}, Cr Revenue {formatCurrency(example.calc.revenueGross)}, Cr Sales tax {formatCurrency(example.calc.tax)}.
            </div>
          )}
        </section>

        {/* 3. POS */}
        <section className="bg-white border border-[#E4E4E7] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold">3. POS counter sales</h2>
          <div>
            <span className="text-[11px] text-[#71717A]">When to charge tax</span>
            <select className={field} disabled={disabled} value={policy.pos.mode} onChange={(e) => setPos({ mode: e.target.value as any })}>
              <option value="off">Never</option>
              <option value="cashier">Cashier ticks “apply tax” per sale (current behaviour)</option>
              <option value="always">On every sale</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-[11px] text-[#71717A]">Rate (blank = default sales rate)</span><RateSelect disabled={disabled} value={policy.pos.rateCode} onChange={(v) => setPos({ rateCode: v })} rates={rates} purpose="sales" /></div>
            <div>
              <span className="text-[11px] text-[#71717A]">Shelf prices are</span>
              <select className={field} disabled={disabled} value={policy.pos.pricesIncludeTax ? "inc" : "exc"} onChange={(e) => setPos({ pricesIncludeTax: e.target.value === "inc" })}>
                <option value="exc">Before tax</option>
                <option value="inc">Tax-inclusive</option>
              </select>
            </div>
          </div>
          <Toggle disabled={disabled} checked={policy.pos.applyAfterDiscount} onChange={(v) => setPos({ applyAfterDiscount: v })} label="Work out tax after the discount" />
          <p className="text-[11px] text-[#71717A]">The server works out the tax itself; sales tax goes to the tax account, not revenue.</p>
        </section>

        {/* 4. Supplier bills */}
        <section className="bg-white border border-[#E4E4E7] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold">4. Supplier bills (procurement)</h2>
          <Toggle disabled={disabled} checked={policy.procurement.recordInputTax} onChange={(v) => setProc({ recordInputTax: v })} label="Sales tax on bills is claimable input tax" hint="On: Dr Input tax (1160). Off: the tax is treated as part of the cost (price variance 5050)." />
          <Toggle disabled={disabled} checked={policy.procurement.autoCalculate} onChange={(v) => setProc({ autoCalculate: v })} label="Calculate bill tax from a rate (instead of typing it)" />
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-[11px] text-[#71717A]">Purchase tax rate</span><RateSelect disabled={disabled || !policy.procurement.autoCalculate} value={policy.procurement.rateCode} onChange={(v) => setProc({ rateCode: v })} rates={rates} purpose="purchases" /></div>
            <div className="pt-4"><Toggle disabled={disabled || !policy.procurement.autoCalculate} checked={policy.procurement.applyAfterDiscount} onChange={(v) => setProc({ applyAfterDiscount: v })} label="After supplier discount" /></div>
          </div>
          <p className="text-[11px] text-[#71717A]">GR/IR clearing always clears at the tax-free value; supplier discounts still reduce cost through price variance.</p>
        </section>

        {/* 5. Projects */}
        <section className="bg-white border border-[#E4E4E7] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold">5. Project progress billing</h2>
          <Toggle disabled={disabled} checked={policy.projects.enabled} onChange={(v) => setProj({ enabled: v })} label="Charge tax on project bills" hint="The contract/progress figure stays tax-free; tax is added on the invoice." />
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-[11px] text-[#71717A]">Rate</span><RateSelect disabled={disabled} value={policy.projects.rateCode} onChange={(v) => setProj({ rateCode: v })} rates={rates} purpose="sales" /></div>
            <div>
              <span className="text-[11px] text-[#71717A]">Billed amounts are</span>
              <select className={field} disabled={disabled} value={policy.projects.pricesIncludeTax ? "inc" : "exc"} onChange={(e) => setProj({ pricesIncludeTax: e.target.value === "inc" })}>
                <option value="exc">Before tax</option>
                <option value="inc">Tax-inclusive</option>
              </select>
            </div>
          </div>
        </section>

        {/* 6. WHT */}
        <section className="bg-white border border-[#E4E4E7] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold">6. Withholding tax (WHT)</h2>
          <Toggle disabled={disabled} checked={policy.wht.deductOnSupplierPayments} onChange={(v) => setWht({ deductOnSupplierPayments: v })} label="Deduct WHT when paying suppliers" hint="Uses the supplier's own WHT % (below); exempt suppliers are skipped. Posts Cr WHT payable (2200)." />
          <div><span className="text-[11px] text-[#71717A]">Default WHT rate for suppliers without their own %</span><RateSelect disabled={disabled} value={policy.wht.defaultRateCode} onChange={(v) => setWht({ defaultRateCode: v })} rates={rates} purpose="wht" /></div>
          <Toggle disabled={disabled} checked={policy.wht.allowOnCustomerReceipts} onChange={(v) => setWht({ allowOnCustomerReceipts: v })} label="Allow recording WHT that customers deduct from their payments" hint="Booked as WHT receivable (1170) and settles the invoice." />
        </section>

        {/* 7. Rounding */}
        <section className="bg-white border border-[#E4E4E7] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold">7. Rounding</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[11px] text-[#71717A]">Round tax</span>
              <select className={field} disabled={disabled} value={policy.rounding.mode} onChange={(e) => setPolicy((p) => ({ ...p, rounding: { ...p.rounding, mode: e.target.value as any } }))}>
                <option value="nearest">To nearest</option>
                <option value="up">Always up</option>
                <option value="down">Always down</option>
              </select>
            </div>
            <div>
              <span className="text-[11px] text-[#71717A]">To</span>
              <select className={field} disabled={disabled} value={policy.rounding.decimals} onChange={(e) => setPolicy((p) => ({ ...p, rounding: { ...p.rounding, decimals: Number(e.target.value) === 0 ? 0 : 2 } }))}>
                <option value={2}>Paisa (0.01)</option>
                <option value={0}>Whole rupee</option>
              </select>
            </div>
          </div>
        </section>
      </div>

      {/* 8. Parties */}
      <section className="bg-white border border-[#E4E4E7] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#0D7A5F]" />
          <h2 className="text-sm font-bold">8. Customer & supplier tax details</h2>
        </div>
        <div className="flex gap-2">
          <input className={field} value={partyQuery} onChange={(e) => setPartyQuery(e.target.value)} placeholder="Search customer or supplier name / phone" />
          <button type="button" onClick={loadParties} className="h-8 px-3 rounded-lg border text-xs font-semibold">Search</button>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-bold mb-1">Customers</h3>
            {parties.customers.map((c, idx) => (
              <div key={c.id} className="grid grid-cols-[1.3fr_1fr_1fr_auto_auto] gap-1.5 items-center py-1 border-b text-xs">
                <span className="truncate" title={c.phone}>{c.name}</span>
                <input className={field} disabled={disabled} placeholder="NTN" value={c.ntnNumber || ""} onChange={(e) => setParties((p) => ({ ...p, customers: p.customers.map((x, i) => (i === idx ? { ...x, ntnNumber: e.target.value } : x)) }))} />
                <input className={field} disabled={disabled} placeholder="STRN" value={c.strnNumber || ""} onChange={(e) => setParties((p) => ({ ...p, customers: p.customers.map((x, i) => (i === idx ? { ...x, strnNumber: e.target.value } : x)) }))} />
                <label className="flex items-center gap-1 whitespace-nowrap"><input type="checkbox" disabled={disabled} checked={Boolean(c.taxExempt)} onChange={(e) => setParties((p) => ({ ...p, customers: p.customers.map((x, i) => (i === idx ? { ...x, taxExempt: e.target.checked } : x)) }))} />Exempt</label>
                <button type="button" disabled={disabled} onClick={() => savePartyRow("customer", c)} className="h-7 px-2 rounded bg-[#0D7A5F] text-white text-[11px] font-bold">Save</button>
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-xs font-bold mb-1">Suppliers</h3>
            {parties.vendors.map((v, idx) => (
              <div key={v.id} className="grid grid-cols-[1.2fr_.9fr_.9fr_.6fr_auto_auto] gap-1.5 items-center py-1 border-b text-xs">
                <span className="truncate">{v.name}</span>
                <input className={field} disabled={disabled} placeholder="NTN" value={v.ntnNumber || ""} onChange={(e) => setParties((p) => ({ ...p, vendors: p.vendors.map((x, i) => (i === idx ? { ...x, ntnNumber: e.target.value } : x)) }))} />
                <input className={field} disabled={disabled} placeholder="STRN" value={v.strnNumber || ""} onChange={(e) => setParties((p) => ({ ...p, vendors: p.vendors.map((x, i) => (i === idx ? { ...x, strnNumber: e.target.value } : x)) }))} />
                <input className={field} disabled={disabled} type="number" step="0.01" min="0" max="100" title="WHT %" value={v.whtRate ?? 0} onChange={(e) => setParties((p) => ({ ...p, vendors: p.vendors.map((x, i) => (i === idx ? { ...x, whtRate: Number(e.target.value) } : x)) }))} />
                <label className="flex items-center gap-1 whitespace-nowrap"><input type="checkbox" disabled={disabled} checked={Boolean(v.whtExempt)} onChange={(e) => setParties((p) => ({ ...p, vendors: p.vendors.map((x, i) => (i === idx ? { ...x, whtExempt: e.target.checked } : x)) }))} />WHT exempt</label>
                <button type="button" disabled={disabled} onClick={() => savePartyRow("vendor", v)} className="h-7 px-2 rounded bg-[#0D7A5F] text-white text-[11px] font-bold">Save</button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
