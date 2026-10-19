export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { actorHasPermission, resolveJobsActor } from "@/lib/auth/erpActor";
import { SHARED_SETTING_KEYS, SHARED_SETTING_PERMISSIONS } from "@/lib/sharedSettings";

const MAX_ITEMS = 1000;
const MAX_BYTES = 100_000;

function validate(key: string, value: unknown): string | null {
  if (!Array.isArray(value)) return "Value must be a list.";
  if (value.length > MAX_ITEMS) return `A list can have at most ${MAX_ITEMS} entries.`;
  if (JSON.stringify(value).length > MAX_BYTES) return "This list is too large.";
  if (key === "workman_stock_units") {
    for (const u of value) {
      if (!u || typeof u !== "object" || typeof (u as any).name !== "string" || !(u as any).name.trim()) {
        return "Each stock unit needs a name.";
      }
    }
    const names = value.map((u: any) => String(u.name).trim().toLowerCase());
    if (new Set(names).size !== names.length) return "Stock unit names must be unique.";
    return null;
  }
  for (const item of value) {
    if (typeof item === "string") {
      if (!item.trim() || item.length > 120) return "Entries must be 1-120 characters.";
    } else if (!item || typeof item !== "object") {
      return "Invalid entry in list.";
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const resolved = await resolveJobsActor(req);
  if (resolved.error) return resolved.error;
  if (!resolved.actor.role || resolved.actor.role === "anonymous") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  let rows: { key: string; value: unknown }[] = [];
  try {
    rows = await prisma.appSetting.findMany({ where: { key: { in: SHARED_SETTING_KEYS } } });
  } catch {
    rows = []; // table not migrated yet
  }
  return NextResponse.json(
    { settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PUT(req: NextRequest) {
  const resolved = await resolveJobsActor(req);
  if (resolved.error) return resolved.error;
  const actor = resolved.actor;
  const body = await req.json().catch(() => ({}));
  const key = String(body.key || "");
  const needed = SHARED_SETTING_PERMISSIONS[key];
  if (!needed) return NextResponse.json({ error: "Unknown setting." }, { status: 400 });
  if (resolved.viaMobileToken || !needed.some((k) => actorHasPermission(actor, k))) {
    return NextResponse.json({ error: `You need '${needed.join("' or '")}' to change this setting.`, code: "PERMISSION_DENIED" }, { status: 403 });
  }
  const problem = validate(key, body.value);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const value = body.value as Prisma.InputJsonValue;
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value, updatedBy: actor.name },
    update: { value, updatedBy: actor.name },
  });
  return NextResponse.json({ ok: true });
}
