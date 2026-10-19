export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorHasPermission, resolveJobsActor } from "@/lib/auth/erpActor";
import { AuditService } from "@/lib/services/AuditService";

const KEYS = ["settings.taxes", "settings.accounting"];

async function gate(req: NextRequest) {
  const resolved = await resolveJobsActor(req);
  if (resolved.error) return { error: resolved.error };
  if (!KEYS.some((k) => actorHasPermission(resolved.actor, k))) {
    return { error: NextResponse.json({ error: "You do not have permission to change tax settings." }, { status: 403 }) };
  }
  return { actor: resolved.actor };
}

const clean = (v: unknown, max = 40) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Customer / supplier tax registration: tax-exempt flag, NTN, STRN, supplier WHT %. */
export async function GET(req: NextRequest) {
  const g = await gate(req);
  if (g.error) return g.error;
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const where = q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q } }] } : {};
  const [customers, vendors] = await Promise.all([
    prisma.customer.findMany({
      where,
      select: { id: true, name: true, phone: true, taxExempt: true, ntnNumber: true, strnNumber: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
    prisma.vendor.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : {},
      select: { id: true, name: true, ntnNumber: true, strnNumber: true, whtRate: true, whtExempt: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
  ]);
  return NextResponse.json({ customers, vendors });
}

export async function PATCH(req: NextRequest) {
  const g = await gate(req);
  if (g.error) return g.error;
  const body = await req.json().catch(() => null);
  if (!body?.id || !["customer", "vendor"].includes(body.partyType)) {
    return NextResponse.json({ error: "partyType (customer/vendor) and id are required." }, { status: 400 });
  }
  if (body.partyType === "customer") {
    const updated = await prisma.customer.update({
      where: { id: String(body.id) },
      data: { taxExempt: Boolean(body.taxExempt), ntnNumber: clean(body.ntnNumber), strnNumber: clean(body.strnNumber) },
      select: { id: true, name: true, taxExempt: true, ntnNumber: true, strnNumber: true },
    });
    await AuditService.logActivity({
      actorName: g.actor!.name || "User",
      actorRole: g.actor!.role,
      category: "DATA_MUTATION",
      action: `Updated tax registration for customer ${updated.name} (exempt: ${updated.taxExempt ? "yes" : "no"})`,
      target: `Customer:${updated.id}`,
    }).catch(() => undefined);
    return NextResponse.json({ success: true, customer: updated });
  }
  const whtRate = Number(body.whtRate);
  if (!Number.isFinite(whtRate) || whtRate < 0 || whtRate > 100) {
    return NextResponse.json({ error: "Supplier WHT % must be between 0 and 100." }, { status: 400 });
  }
  const updated = await prisma.vendor.update({
    where: { id: String(body.id) },
    data: { whtExempt: Boolean(body.whtExempt), whtRate, ntnNumber: clean(body.ntnNumber), strnNumber: clean(body.strnNumber) },
    select: { id: true, name: true, ntnNumber: true, strnNumber: true, whtRate: true, whtExempt: true },
  });
  await AuditService.logActivity({
    actorName: g.actor!.name || "User",
    actorRole: g.actor!.role,
    category: "DATA_MUTATION",
    action: `Updated tax registration for supplier ${updated.name} (WHT ${updated.whtExempt ? "exempt" : `${updated.whtRate}%`})`,
    target: `Vendor:${updated.id}`,
  }).catch(() => undefined);
  return NextResponse.json({ success: true, vendor: updated });
}
