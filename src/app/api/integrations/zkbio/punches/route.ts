export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";
import { checkSyncToken, mapPunchType } from "@/lib/integrations/zkbio";

/**
 * /api/integrations/zkbio/punches
 *
 * POST — ingest endpoint for the client-PC poller. Authenticated by the
 *        shared sync token (x-zkbio-sync-token header), NOT by a user
 *        login: the poller is a machine, not a person. Punches land in
 *        the separate DevicePunch table (decided 2026-11-16) and are
 *        deduped on the ZKBio transaction id, so re-sent windows are
 *        harmless. Punches whose emp_code has no HR mapping yet still
 *        import, with employeeId = null.
 *
 * GET  — HR/admin read access (normal ERP login, admin/HR roles) so
 *        imported punches can be reviewed: ?from=&to=&employeeId=&
 *        empCode=&unmapped=1&limit=
 */

const MAX_BATCH = 1000;

function str(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normalizePunch(raw: any) {
  const txnId = str(raw?.txnId ?? raw?.zkbioTxnId ?? raw?.id);
  const empCode = str(raw?.empCode ?? raw?.emp_code);
  const timeRaw = raw?.punchTime ?? raw?.punch_time;
  const punchTime = timeRaw ? new Date(timeRaw) : null;
  if (!txnId || !empCode || !punchTime || isNaN(punchTime.getTime())) {
    return null;
  }
  const nameFromParts = [str(raw?.first_name), str(raw?.last_name)]
    .filter(Boolean)
    .join(" ");
  const rawState = raw?.punchState ?? raw?.punch_state;
  const stateText = str(raw?.punchStateText ?? raw?.punch_state_display);
  return {
    zkbioTxnId: txnId,
    empCode,
    employeeName: str(raw?.employeeName) || nameFromParts || null,
    punchTime,
    punchType: mapPunchType(
      rawState !== null && rawState !== undefined ? String(rawState) : null,
      stateText
    ),
    rawPunchState:
      rawState !== null && rawState !== undefined ? String(rawState) : null,
    punchStateText: stateText,
    verifyType: str(raw?.verifyType ?? raw?.verify_type_display ?? raw?.verify_type),
    terminalSn: str(raw?.terminalSn ?? raw?.terminal_sn),
    terminalAlias: str(raw?.terminalAlias ?? raw?.terminal_alias),
  };
}

export async function POST(req: NextRequest) {
  try {
    const tokenCheck = checkSyncToken(req);
    if (tokenCheck === "not_configured") {
      return NextResponse.json(
        { error: "ZKBio sync is not configured on this server." },
        { status: 503 }
      );
    }
    if (tokenCheck !== "ok") {
      return NextResponse.json(
        { error: "Unauthorized: invalid sync token." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const list: any[] = Array.isArray(body) ? body : body?.punches;
    if (!Array.isArray(list)) {
      return NextResponse.json(
        { error: "Body must be { punches: [...] }." },
        { status: 400 }
      );
    }
    if (list.length > MAX_BATCH) {
      return NextResponse.json(
        { error: `Batch too large: ${list.length} punches (max ${MAX_BATCH}).` },
        { status: 400 }
      );
    }

    const valid: NonNullable<ReturnType<typeof normalizePunch>>[] = [];
    let invalid = 0;
    for (const raw of list) {
      const row = normalizePunch(raw);
      if (row) valid.push(row);
      else invalid++;
    }

    if (valid.length === 0) {
      return NextResponse.json({
        success: true,
        received: list.length,
        invalid,
        inserted: 0,
        duplicates: 0,
        unmapped: 0,
        unmappedEmpCodes: [],
      });
    }

    // Resolve HR mappings for the batch's emp_codes in one query.
    const empCodes = [...new Set(valid.map((r) => r.empCode))];
    const maps = await prisma.zkbioEmployeeMap.findMany({
      where: { empCode: { in: empCodes } },
      select: { empCode: true, employeeId: true },
    });
    const employeeByCode = new Map(maps.map((m) => [m.empCode, m.employeeId]));

    // Which transaction ids are already stored (for exact reporting;
    // the insert itself also skips duplicates).
    const existing = await prisma.devicePunch.findMany({
      where: { zkbioTxnId: { in: valid.map((r) => r.zkbioTxnId) } },
      select: { zkbioTxnId: true },
    });
    const existingIds = new Set(existing.map((e) => e.zkbioTxnId));

    const rows = valid.map((r) => ({
      ...r,
      employeeId: employeeByCode.get(r.empCode) ?? null,
    }));

    const result = await prisma.devicePunch.createMany({
      data: rows,
      skipDuplicates: true,
    });

    const freshUnmapped = rows.filter(
      (r) => !existingIds.has(r.zkbioTxnId) && !r.employeeId
    );
    return NextResponse.json({
      success: true,
      received: list.length,
      invalid,
      inserted: result.count,
      duplicates: rows.length - result.count,
      unmapped: freshUnmapped.length,
      unmappedEmpCodes: [...new Set(freshUnmapped.map((r) => r.empCode))],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to import punches." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication credentials." },
        { status: 401 }
      );
    }
    if (!caller.isAdminOrHr) {
      return NextResponse.json(
        { error: "Forbidden: Only administrators and HR personnel can view device punches." },
        { status: 403 }
      );
    }

    const q = req.nextUrl.searchParams;
    const where: any = {};
    const from = q.get("from");
    const to = q.get("to");
    if (from || to) {
      where.punchTime = {};
      if (from) where.punchTime.gte = new Date(from);
      if (to) where.punchTime.lte = new Date(to);
    }
    if (q.get("employeeId")) where.employeeId = q.get("employeeId");
    if (q.get("empCode")) where.empCode = q.get("empCode");
    if (q.get("unmapped") === "1" || q.get("unmapped") === "true") {
      where.employeeId = null;
    }
    const limit = Math.min(Math.max(parseInt(q.get("limit") || "200", 10) || 200, 1), 1000);

    const [total, punches] = await Promise.all([
      prisma.devicePunch.count({ where }),
      prisma.devicePunch.findMany({
        where,
        orderBy: { punchTime: "desc" },
        take: limit,
        include: { employee: { select: { id: true, name: true } } },
      }),
    ]);

    return NextResponse.json({ success: true, count: total, punches });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load device punches." },
      { status: 500 }
    );
  }
}
