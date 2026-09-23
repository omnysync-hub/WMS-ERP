export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";

export const LOCATION_SURVEILLANCE_POLICY_VERSION = "1.0";
export const LOCATION_SURVEILLANCE_DISCLOSURE_TEXT =
  "Workman Services Field Operations collects background GPS location, speed, device movement, and battery telemetry while you are logged in and working on assigned jobs or company shifts. This data is used solely for proximity-based job dispatch, emergency field assistance, arrival verification, customer safety, and route optimization. Location data is retained for 90 days in accordance with company policy.";

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication credentials." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId") || caller.id;

    if (caller.id !== employeeId && !caller.isAdminOrHr) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view consent records for another employee." },
        { status: 403 }
      );
    }

    const latestConsent = await prisma.technicianConsentRecord.findFirst({
      where: {
        employeeId,
        consentType: "LOCATION_SURVEILLANCE",
      },
      orderBy: { acknowledgedAt: "desc" },
    });

    const isUpToDate =
      latestConsent !== null &&
      latestConsent.isAcknowledged &&
      latestConsent.policyVersion === LOCATION_SURVEILLANCE_POLICY_VERSION;

    return NextResponse.json({
      hasConsent: Boolean(isUpToDate),
      policyVersion: LOCATION_SURVEILLANCE_POLICY_VERSION,
      disclosureText: LOCATION_SURVEILLANCE_DISCLOSURE_TEXT,
      latestRecord: latestConsent,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication credentials." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { employeeId, deviceModel, policyVersion = LOCATION_SURVEILLANCE_POLICY_VERSION } = body;

    const targetEmployeeId = employeeId || caller.id;

    if (caller.id !== targetEmployeeId && !caller.isAdminOrHr) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to record consent for another employee." },
        { status: 403 }
      );
    }

    const ipAddress =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const consent = await prisma.technicianConsentRecord.create({
      data: {
        employeeId: targetEmployeeId,
        consentType: "LOCATION_SURVEILLANCE",
        policyVersion,
        disclosureText: LOCATION_SURVEILLANCE_DISCLOSURE_TEXT,
        isAcknowledged: true,
        acknowledgedAt: new Date(),
        ipAddress,
        deviceModel: deviceModel || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Location surveillance disclosure acknowledged successfully.",
      consent,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
