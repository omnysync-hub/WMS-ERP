export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveJobsActor, type ErpActor } from "@/lib/auth/erpActor";
import {
  workshopActionGate,
  workshopParticipantGate,
  workshopReportsGate,
} from "@/lib/auth/workshopGate";
import { pktParts } from "@/lib/pktTime";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-actor-role, x-actor-name, x-actor-id, *",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Bike fuel-meter readings (fleet bikes, Bikes workshop app).
 *
 * Riders submit two readings per bike per day — "morning" (start) and
 * "afternoon" (return) — each with a meter photo (data URL, the same
 * storage pattern as Job.completionPhotos) and a typed odometer value.
 *
 * `readingDate` carries date-only semantics: it is stored at UTC midnight
 * of the Pakistan calendar day the reading belongs to.
 *
 * Duplicate policy: one reading per bike + day + period. A second submit
 * is REJECTED (409) — readings are the fuel-audit record, so corrections
 * go through a manager rather than silently replacing the original.
 */

const PERIODS = ["morning", "afternoon"] as const;
type Period = (typeof PERIODS)[number];

/** Same per-photo cap JobsService.completeJob applies to proof photos. */
const MAX_PHOTO_CHARS = 2_700_000;

/** Parse a strict YYYY-MM-DD string to the UTC-midnight Date we store. */
function parseReadingDate(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** UTC midnight of today's Pakistan calendar day. */
function todayReadingDate(): Date {
  const { year, month, day } = pktParts(new Date());
  return new Date(Date.UTC(year, month, day));
}

function dayRange(date: Date): { gte: Date; lt: Date } {
  return { gte: date, lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) };
}

/**
 * The Employee id behind an actor: the actor id IS the Employee id for
 * mobile sessions; web sessions resolve through the `erpUserId` link.
 */
async function resolveEmployeeId(actor: ErpActor): Promise<string | null> {
  if (!actor?.id || actor.id === "anonymous") return null;
  const byId = await prisma.employee.findUnique({ where: { id: actor.id }, select: { id: true } });
  if (byId) return byId.id;
  const byUser = await prisma.employee.findUnique({
    where: { erpUserId: actor.id },
    select: { id: true },
  });
  return byUser?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;
    const actor = resolved.actor;

    // Any workshop staff member can submit a reading — the submitter is the
    // rider, and their identity is recorded from the session, never the body.
    const gate = await workshopActionGate(actor, {
      workshopRoles: ["mechanic", "storekeeper", "supervisor", "manager"],
    });
    if (gate) return gate;

    const employeeId = await resolveEmployeeId(actor);
    if (!employeeId) {
      return NextResponse.json(
        { error: "Your account is not linked to an employee record, so a reading cannot be recorded under your name." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({} as any));

    const bikeRegNo = typeof body.bikeRegNo === "string" ? body.bikeRegNo.trim().toUpperCase() : "";
    if (!bikeRegNo) {
      return NextResponse.json({ error: "Bike registration number is required." }, { status: 400 });
    }

    const period = typeof body.period === "string" ? body.period.trim().toLowerCase() : "";
    if (!PERIODS.includes(period as Period)) {
      return NextResponse.json(
        { error: "Period must be 'morning' or 'afternoon'." },
        { status: 400 }
      );
    }

    const odometerKm = Number(body.odometerKm);
    if (!Number.isFinite(odometerKm) || odometerKm < 0) {
      return NextResponse.json(
        { error: "Odometer reading (km) is required and must be a number of 0 or more." },
        { status: 400 }
      );
    }

    const photo = typeof body.photo === "string" ? body.photo : "";
    if (!/^(data:image\/|https?:\/\/)/i.test(photo)) {
      return NextResponse.json(
        { error: "A photo of the meter is required with every reading." },
        { status: 400 }
      );
    }
    if (photo.startsWith("data:image/") && photo.length > MAX_PHOTO_CHARS) {
      return NextResponse.json(
        { error: "The meter photo is too large (must be smaller than 2 MB). Retake it and retry." },
        { status: 400 }
      );
    }

    let readingDate = todayReadingDate();
    if (body.readingDate != null && body.readingDate !== "") {
      const parsed = parseReadingDate(body.readingDate);
      if (!parsed) {
        return NextResponse.json(
          { error: "readingDate must be in YYYY-MM-DD format." },
          { status: 400 }
        );
      }
      readingDate = parsed;
    }

    const range = dayRange(readingDate);
    const existing = await prisma.bikeMeterReading.findFirst({
      where: {
        bikeRegNo,
        period,
        readingDate: { gte: range.gte, lt: range.lt },
      },
      include: { employee: { select: { name: true } } },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: `A ${period} reading for bike ${bikeRegNo} on ${dateKey(readingDate)} has already been submitted by ${existing.employee?.name || "another rider"}. If it is wrong, ask a manager to correct it.`,
          code: "DUPLICATE_READING",
        },
        { status: 409 }
      );
    }

    try {
      const created = await prisma.bikeMeterReading.create({
        data: { bikeRegNo, employeeId, readingDate, period, odometerKm, photo },
        include: { employee: { select: { id: true, name: true } } },
      });
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return NextResponse.json(
          {
            error: `A ${period} reading for bike ${bikeRegNo} on ${dateKey(readingDate)} has already been submitted. If it is wrong, ask a manager to correct it.`,
            code: "DUPLICATE_READING",
          },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (err: any) {
    console.error("POST /api/workshops/meter-readings error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save the meter reading" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;
    const actor = resolved.actor;

    const participantGate = await workshopParticipantGate(actor);
    if (participantGate) return participantGate;

    const { searchParams } = new URL(req.url);

    let readingDate = todayReadingDate();
    const rawDate = searchParams.get("date");
    if (rawDate) {
      const parsed = parseReadingDate(rawDate);
      if (!parsed) {
        return NextResponse.json(
          { error: "date must be in YYYY-MM-DD format." },
          { status: 400 }
        );
      }
      readingDate = parsed;
    }

    const bikeFilter = (searchParams.get("bikeRegNo") || "").trim().toUpperCase();

    // Reviewers (ERP admin / manager, or jobs.reports holders) see every
    // bike; everyone else sees only their own submissions.
    const isReviewer = workshopReportsGate(actor) === null;

    const where: any = { readingDate: dayRange(readingDate) };
    if (bikeFilter) where.bikeRegNo = bikeFilter;
    if (!isReviewer) {
      const employeeId = await resolveEmployeeId(actor);
      where.employeeId = employeeId ?? "__none__";
    }

    const readings = await prisma.bikeMeterReading.findMany({
      where,
      include: { employee: { select: { id: true, name: true } } },
      orderBy: [{ bikeRegNo: "asc" }, { createdAt: "asc" }],
    });

    // Per-bike day summary. NOTE: there is no fleet registry, so the
    // expected-bike list is derived from the bikes that have at least one
    // reading this day — a bike with NO readings at all cannot be flagged
    // as missing. A bike with a morning but no afternoon (or vice versa)
    // is flagged in `missing`.
    const byBike = new Map<string, { morning: any | null; afternoon: any | null }>();
    for (const r of readings) {
      const entry = byBike.get(r.bikeRegNo) ?? { morning: null, afternoon: null };
      if (r.period === "morning") entry.morning = r;
      else if (r.period === "afternoon") entry.afternoon = r;
      byBike.set(r.bikeRegNo, entry);
    }

    const bikes = Array.from(byBike.entries()).map(([bikeRegNo, entry]) => {
      const missing = PERIODS.filter((p) => !entry[p]);
      const distanceKm =
        entry.morning && entry.afternoon
          ? Math.round((entry.afternoon.odometerKm - entry.morning.odometerKm) * 10) / 10
          : null;
      return { bikeRegNo, morning: entry.morning, afternoon: entry.afternoon, distanceKm, missing };
    });

    const missing = bikes
      .filter((b) => b.missing.length > 0)
      .map((b) => ({ bikeRegNo: b.bikeRegNo, missing: b.missing }));

    return NextResponse.json({
      success: true,
      date: dateKey(readingDate),
      count: readings.length,
      data: readings,
      bikes,
      missing,
    });
  } catch (err: any) {
    console.error("GET /api/workshops/meter-readings error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load meter readings" },
      { status: 500 }
    );
  }
}
