export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveJobsActor, roleHasPermission } from "@/lib/auth/erpActor";
import { EMPTY_COMPANY_PROFILE, normalizeCompanyProfile } from "@/lib/companyProfile";

function canViewHrReadiness(role: string) {
  return role === "admin" || roleHasPermission(role, "hrm.view_employees") || roleHasPermission(role, "hrm.manage_employees");
}

function canEditCompanyProfile(role: string) {
  return role === "admin" || roleHasPermission(role, "settings.accounting") || roleHasPermission(role, "hrm.manage_employees");
}

export async function GET(req: NextRequest) {
  try {
    const settings = await prisma.companySettings.findFirst();
    const profile = normalizeCompanyProfile(settings || EMPTY_COMPANY_PROFILE);
    const includeReadiness = new URL(req.url).searchParams.get("includeReadiness") === "1";

    if (!includeReadiness) {
      return NextResponse.json({ profile });
    }

    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;
    if (!canViewHrReadiness(resolved.actor.role)) {
      return NextResponse.json({ error: "You do not have permission to view company onboarding." }, { status: 403 });
    }

    const [employeeCount, departments, designations, leaveTypeCount, holidayCount, geofenceCount] = await Promise.all([
      prisma.employee.count({ where: { status: "Active" } }),
      prisma.employee.findMany({ where: { department: { not: "" } }, select: { department: true }, distinct: ["department"] }),
      prisma.employee.findMany({ where: { designation: { not: "" } }, select: { designation: true }, distinct: ["designation"] }),
      prisma.leaveType.count(),
      prisma.companyHoliday.count(),
      prisma.geofenceZone.count({ where: { isActive: true } }),
    ]);

    const profileComplete = Boolean(profile.legalName && profile.addressText && profile.phone && profile.email);
    const readiness = {
      profileComplete,
      employeeCount,
      departmentCount: departments.length,
      designationCount: designations.length,
      leaveTypeCount,
      holidayCount,
      geofenceCount,
    };

    return NextResponse.json({
      profile,
      readiness,
      checklist: [
        { key: "profile", label: "Company identity and contact details", complete: profileComplete },
        { key: "employees", label: "Employees imported or added", complete: employeeCount > 0 },
        { key: "structure", label: "Departments and designations defined", complete: departments.length > 0 && designations.length > 0 },
        { key: "leave", label: "Leave types and holiday calendar configured", complete: leaveTypeCount > 0 && holidayCount > 0 },
        { key: "attendance", label: "Attendance workplace or geofence configured", complete: geofenceCount > 0 },
      ],
    });
  } catch (error) {
    console.error("GET /api/company-profile failed", error);
    return NextResponse.json({ error: "Could not load company profile." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;
    if (!canEditCompanyProfile(resolved.actor.role)) {
      return NextResponse.json({ error: "You do not have permission to update company onboarding." }, { status: 403 });
    }

    const body = await req.json();
    const legalName = String(body.legalName || "").trim();
    const addressText = String(body.addressText || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const fiscalYearStartMonth = Number(body.fiscalYearStartMonth) || 7;

    if (!legalName || !addressText || !phone || !email) {
      return NextResponse.json(
        { error: "Legal name, address, phone, and company email are required." },
        { status: 400 }
      );
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid company email address." }, { status: 400 });
    }
    if (fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) {
      return NextResponse.json({ error: "Fiscal year start month must be between 1 and 12." }, { status: 400 });
    }

    const data = {
      legalName,
      tradeName: String(body.tradeName || "").trim() || null,
      addressText,
      phone,
      email,
      ntnNumber: String(body.ntnNumber || "").trim() || null,
      strnNumber: String(body.strnNumber || "").trim() || null,
      baseCurrency: String(body.baseCurrency || "PKR").trim().toUpperCase(),
      fiscalYearStartMonth,
    };

    const existing = await prisma.companySettings.findFirst();
    const settings = existing
      ? await prisma.companySettings.update({ where: { id: existing.id }, data })
      : await prisma.companySettings.create({ data });

    return NextResponse.json({ success: true, profile: normalizeCompanyProfile(settings) });
  } catch (error) {
    console.error("PATCH /api/company-profile failed", error);
    return NextResponse.json({ error: "Could not save company profile." }, { status: 500 });
  }
}
