export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorHasPermission, resolveJobsActor } from "@/lib/auth/erpActor";
import { AuditService } from "@/lib/services/AuditService";
import { AccountMappingService } from "@/lib/services/AccountMappingService";
import {
  DEFAULT_TAX_POLICY,
  TAX_ACCOUNT_ROLES,
  normalizeTaxPolicy,
  normalizeTaxRates,
  type TaxPolicy,
  type TaxRateConfig,
} from "@/lib/tax/taxConfig";

const WRITE_KEYS = ["settings.taxes", "settings.accounting"];

async function roleAccounts() {
  const out: Record<string, { code: string; name: string } | null> = {};
  for (const r of TAX_ACCOUNT_ROLES) {
    const acc = await AccountMappingService.resolveAccountOptional({ transactionType: r.value });
    out[r.value] = acc ? { code: acc.code, name: acc.name } : null;
  }
  return out;
}

/** Any signed-in user can read tax settings (POS, job screens and the app need them). */
export async function GET(req: NextRequest) {
  const resolved = await resolveJobsActor(req);
  if (resolved.error) return resolved.error;
  if (!resolved.actor.role || resolved.actor.role === "anonymous") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const settings = await prisma.companySettings.findFirst({ select: { taxRules: true, taxPolicy: true } });
  const canEdit = WRITE_KEYS.some((k) => actorHasPermission(resolved.actor, k));
  return NextResponse.json({
    rates: normalizeTaxRates(settings?.taxRules),
    policy: normalizeTaxPolicy(settings?.taxPolicy),
    defaults: DEFAULT_TAX_POLICY,
    roleAccounts: await roleAccounts(),
    canEdit,
  });
}

function validateRates(rates: TaxRateConfig[]): string | null {
  for (const r of rates) {
    if (!r.name) return "Every tax rate needs a name.";
    if (!/^[A-Z0-9_-]{2,20}$/.test(r.code)) return `Tax code "${r.code || r.name}" must be 2-20 letters/numbers (e.g. GST18, PRA16).`;
    if (!(r.rate >= 0 && r.rate <= 100)) return `${r.code}: rate must be between 0 and 100.`;
  }
  // The same code may repeat only with different effective-from dates (rate history).
  const keys = rates.map((r) => `${r.code}|${r.effectiveFrom || ""}`);
  if (new Set(keys).size !== keys.length) return "Two rates have the same code and effective-from date.";
  return null;
}

function validatePolicy(policy: TaxPolicy, rates: TaxRateConfig[]): string | null {
  const has = (code: string | null, purpose: "sales" | "purchases" | "wht") => {
    if (!code) return true;
    return rates.some(
      (r) =>
        r.code === code &&
        (purpose === "wht" ? r.type === "withholding" : r.type !== "withholding" && (r.appliesTo === "both" || r.appliesTo === purpose))
    );
  };
  if (policy.jobs.enabled && !policy.jobs.rateCode && Object.keys(policy.jobs.byJobType).length === 0)
    return "Job invoices: choose the tax rate to charge.";
  if (!has(policy.jobs.rateCode, "sales")) return `Job invoices: "${policy.jobs.rateCode}" is not a sales tax rate.`;
  for (const [type, c] of Object.entries(policy.jobs.byJobType)) {
    if (c !== "exempt" && !has(c, "sales")) return `Job type "${type}": "${c}" is not a sales tax rate.`;
  }
  if (policy.pos.mode !== "off" && policy.pos.rateCode && !has(policy.pos.rateCode, "sales")) return "POS: choose a sales tax rate.";
  if (policy.projects.enabled && !policy.projects.rateCode) return "Project billing: choose the tax rate to charge.";
  if (!has(policy.projects.rateCode, "sales")) return "Project billing: choose a sales tax rate.";
  if (policy.procurement.autoCalculate && !policy.procurement.rateCode) return "Supplier bills: choose the rate used to calculate tax.";
  if (!has(policy.procurement.rateCode, "purchases")) return "Supplier bills: choose a purchase tax rate.";
  if (!has(policy.wht.defaultRateCode, "wht")) return "WHT: the default rate must be a withholding tax rate.";
  return null;
}

export async function PUT(req: NextRequest) {
  const resolved = await resolveJobsActor(req);
  if (resolved.error) return resolved.error;
  const actor = resolved.actor;
  if (!WRITE_KEYS.some((k) => actorHasPermission(actor, k))) {
    return NextResponse.json({ error: "You do not have permission to change tax settings.", code: "PERMISSION_DENIED" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const settings = await prisma.companySettings.findFirst();
  if (!settings) return NextResponse.json({ error: "Company settings are not set up yet. Run Setup first." }, { status: 409 });

  const rates = body.rates !== undefined ? normalizeTaxRates(body.rates) : normalizeTaxRates(settings.taxRules);
  const policy = body.policy !== undefined ? normalizeTaxPolicy(body.policy) : normalizeTaxPolicy(settings.taxPolicy);
  const rateErr = validateRates(rates);
  if (rateErr) return NextResponse.json({ error: rateErr }, { status: 400 });
  const policyErr = validatePolicy(policy, rates);
  if (policyErr) return NextResponse.json({ error: policyErr }, { status: 400 });

  // Every role a switched-on rule will post to must be mapped, otherwise postings would fail later.
  const needRoles = new Set<string>();
  const roleOf = (c: string | null) => rates.find((r) => r.code === c)?.accountRole || null;
  if (policy.jobs.enabled) {
    [policy.jobs.rateCode, ...Object.values(policy.jobs.byJobType)].forEach((c) => c && c !== "exempt" && needRoles.add(roleOf(c) || "sales_tax_payable"));
  }
  if (policy.pos.mode !== "off" && policy.pos.rateCode) needRoles.add(roleOf(policy.pos.rateCode) || "sales_tax_payable");
  if (policy.projects.enabled) needRoles.add(roleOf(policy.projects.rateCode) || "sales_tax_payable");
  if (policy.procurement.recordInputTax) needRoles.add("input_tax_receivable");
  if (policy.wht.allowOnCustomerReceipts) needRoles.add("wht_receivable");
  for (const role of needRoles) {
    const acc = await AccountMappingService.resolveAccountOptional({ transactionType: role });
    if (!acc) {
      return NextResponse.json(
        { error: `Map the account role "${role}" in Accounts > Account Mapping before switching this on.` },
        { status: 400 }
      );
    }
  }

  await prisma.companySettings.update({
    where: { id: settings.id },
    data: { taxRules: rates as any, taxPolicy: policy as any },
  });
  await AuditService.logActivity({
    actorName: actor.name || "User",
    actorRole: actor.role,
    category: "DATA_MUTATION",
    action: `Updated tax settings (${rates.length} rate(s); jobs ${policy.jobs.enabled ? "on" : "off"}, POS ${policy.pos.mode}, projects ${policy.projects.enabled ? "on" : "off"}, input tax ${policy.procurement.recordInputTax ? "on" : "off"})`,
    target: "CompanySettings:taxes",
    metadata: { rates, policy },
  }).catch(() => undefined);

  return NextResponse.json({ success: true, rates, policy, roleAccounts: await roleAccounts() });
}
