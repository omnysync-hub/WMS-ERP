export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/lib/services/AuditService";
import { resolveCaller } from "@/lib/auth/mobileAuth";

/**
 * /api/integrations/zkbio/mappings — admin/HR only.
 *
 * GET  — every emp_code ↔ employee mapping, plus the list of emp_codes
 *        seen on imported punches that HR has not mapped yet.
 * POST — create or fix one mapping { empCode, employeeId, zkbioName? }.
 *        Saving a mapping backfills employeeId onto that code's
 *        previously imported, unmapped punches.
 */

async function requireAdminHr(req: NextRequest) {
  const caller = await resolveCaller(req);
  if (!caller) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication credentials." },
        { status: 401 }
      ),
    };
  }
  if (!caller.isAdminOrHr) {
    return {
      error: NextResponse.json(
        { error: "Forbidden: Only administrators and HR personnel can manage ZKBio mappings." },
        { status: 403 }
      ),
    };
  }
  return { caller };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminHr(req);
    if (auth.error) return auth.error;

    const [mappings, unmappedRows] = await Promise.all([
      prisma.zkbioEmployeeMap.findMany({
        orderBy: { empCode: "asc" },
        include: {
          employee: { select: { id: true, name: true, department: true } },
        },
      }),
      prisma.devicePunch.findMany({
        where: { employeeId: null },
        distinct: ["empCode"],
        select: { empCode: true, employeeName: true },
        orderBy: { empCode: "asc" },
      }),
    ]);
    const mappedCodes = new Set(mappings.map((m) => m.empCode));
    const unmapped = unmappedRows.filter((r) => !mappedCodes.has(r.empCode));

    return NextResponse.json({ success: true, mappings, unmapped });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load mappings." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminHr(req);
    if (auth.error) return auth.error;
    const caller = auth.caller!;

    const body = await req.json().catch(() => ({}));
    const empCode = String((body as any)?.empCode ?? "").trim();
    const employeeId = String((body as any)?.employeeId ?? "").trim();
    const zkbioName = String((body as any)?.zkbioName ?? "").trim() || null;
    if (!empCode || !employeeId) {
      return NextResponse.json(
        { error: "Body must be { empCode, employeeId }." },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true },
    });
    if (!employee) {
      return NextResponse.json(
        { error: `Employee with ID "${employeeId}" not found.` },
        { status: 404 }
      );
    }

    const [byCode, byEmp] = await Promise.all([
      prisma.zkbioEmployeeMap.findUnique({ where: { empCode } }),
      prisma.zkbioEmployeeMap.findUnique({ where: { employeeId } }),
    ]);
    if (byCode && byEmp && byCode.id !== byEmp.id) {
      return NextResponse.json(
        {
          error:
            "Conflict: this emp_code is mapped to another employee, and this employee is mapped to another emp_code. Fix one mapping first.",
        },
        { status: 409 }
      );
    }

    let mapping;
    if (byCode) {
      mapping = await prisma.zkbioEmployeeMap.update({
        where: { id: byCode.id },
        data: { employeeId, zkbioName },
      });
    } else if (byEmp) {
      mapping = await prisma.zkbioEmployeeMap.update({
        where: { id: byEmp.id },
        data: { empCode, zkbioName },
      });
    } else {
      mapping = await prisma.zkbioEmployeeMap.create({
        data: { empCode, employeeId, zkbioName },
      });
    }

    // Backfill punches that arrived before this mapping existed.
    const backfill = await prisma.devicePunch.updateMany({
      where: { empCode, employeeId: null },
      data: { employeeId },
    });

    await AuditService.logActivity({
      actorName: caller.name || "HR Administrator",
      actorRole: caller.role,
      actorId: caller.id,
      category: "DATA_MUTATION",
      action: "ZKBIO_EMPLOYEE_MAPPED",
      target: `Employee: ${employee.name} (${employee.id})`,
      metadata: {
        empCode,
        employeeId,
        callerId: caller.id,
        callerRole: caller.role,
        backfilledPunches: backfill.count,
      },
    });

    return NextResponse.json({
      success: true,
      message: `ZKBio code ${empCode} mapped to ${employee.name}. ${backfill.count} earlier punch(es) linked.`,
      mapping,
      backfilled: backfill.count,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save mapping." },
      { status: 500 }
    );
  }
}
