import { prisma } from "@/lib/prisma";
import { pktDateString } from "@/lib/pktTime";

/**
 * UnifiedAttendanceService — read-only merge layer over the two attendance
 * sources of truth:
 *
 *   - AttendanceLog  — mobile app punches (face + GPS geofence). Punch type is
 *                      encoded in the notes prefix: "[CHECK_OUT]" means a
 *                      check-out, anything else is a check-in. This mirrors
 *                      exactly how the HR attendance sheet has always read
 *                      them.
 *   - DevicePunch    — biometric terminal punches (ZKBio / Zlink). Per the
 *                      2026-11-16 decision these stay in their OWN table and
 *                      are never copied into AttendanceLog; this service is
 *                      the layer that makes them visible alongside app
 *                      punches. Only punches whose emp_code HR has mapped
 *                      (employeeId resolved) can be merged — unmapped punches
 *                      (employeeId = null) are excluded here and remain
 *                      reviewable via /api/integrations/zkbio/punches.
 *
 * Merge semantics (documented choices where the raw data is ambiguous):
 *
 *   - De-duplication: an app punch and a machine punch for the same employee
 *     and the same type (CHECK_IN↔CHECK_IN, CHECK_OUT↔CHECK_OUT) within
 *     ±5 minutes are the same physical punch reported twice, and count ONCE.
 *     The machine punch is the surviving record (the fixed terminal is the
 *     source of record), the canonical timestamp is the EARLIER of the two,
 *     and `sources` records both provenances. "OTHER" device punches (break /
 *     overtime states) never de-duplicate and never count as in/out.
 *   - Flagged app logs are NEVER de-duplicated away: a punch HR must review
 *     stays visible as its own entry, even if a machine punch matches it.
 *   - Days are grouped by server-local calendar date, matching the local-day
 *     boundaries the attendance sheet already uses.
 */

export type UnifiedPunchType = "CHECK_IN" | "CHECK_OUT" | "OTHER";
export type UnifiedPunchSource = "app" | "machine";

export const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

export interface UnifiedPunch {
  /** Id of the surviving source row (the machine punch when de-duplicated). */
  id: string;
  employeeId: string;
  timestamp: Date;
  type: UnifiedPunchType;
  /** Primary source of the surviving record. */
  source: UnifiedPunchSource;
  /** Every source that reported this punch (provenance). */
  sources: UnifiedPunchSource[];
  /** True when an app punch and a machine punch were merged into this one. */
  deduped: boolean;
  attendanceLogId: string | null;
  devicePunchId: string | null;
  // App-punch detail (null for pure machine punches)
  notes: string | null;
  flaggedForReview: boolean;
  flagReason: string | null;
  withinGeofence: boolean | null;
  geofenceZoneName: string | null;
  faceMatchScore: number | null;
  livenessScore: number | null;
  // Machine-punch detail (null for pure app punches)
  verifyType: string | null;
  terminalAlias: string | null;
  punchStateText: string | null;
}

export interface UnifiedAttendanceDay {
  employeeId: string;
  /** Server-local calendar date, YYYY-MM-DD. */
  date: string;
  present: boolean;
  firstCheckIn: UnifiedPunch | null;
  lastCheckOut: UnifiedPunch | null;
  punches: UnifiedPunch[];
  /** Sources that reported at least one punch that day. */
  sources: UnifiedPunchSource[];
}

/** Minimal structural shape of an AttendanceLog row this service needs. */
export interface AppPunchInput {
  id: string;
  employeeId: string;
  timestamp: Date;
  notes?: string | null;
  flaggedForReview?: boolean;
  flagReason?: string | null;
  withinGeofence?: boolean | null;
  faceMatchScore?: number | null;
  livenessScore?: number | null;
  geofenceZone?: { name: string } | null;
}

/** Minimal structural shape of a DevicePunch row this service needs. */
export interface DevicePunchInput {
  id: string;
  employeeId: string | null;
  punchTime: Date;
  punchType: string;
  verifyType?: string | null;
  terminalAlias?: string | null;
  punchStateText?: string | null;
}

function appPunchType(notes: string | null | undefined): UnifiedPunchType {
  return notes?.includes("[CHECK_OUT]") ? "CHECK_OUT" : "CHECK_IN";
}

function devicePunchType(raw: string): UnifiedPunchType {
  const t = (raw || "").trim().toUpperCase();
  if (t === "CHECK_IN" || t === "CHECK_OUT") return t;
  return "OTHER";
}

function localDateKey(d: Date): string {
  // Punches are grouped by Pakistan calendar day — the server's local day
  // would split one PKT workday across two groups around midnight.
  return pktDateString(d);
}

export class UnifiedAttendanceService {
  /**
   * Pure merge of already-fetched rows. Returns punches sorted ascending by
   * timestamp. Exported separately so callers that already hold one side of
   * the data (e.g. the payroll route's included attendanceLogs) can merge
   * without re-querying.
   */
  static mergePunches(
    appLogs: AppPunchInput[],
    devicePunches: DevicePunchInput[]
  ): UnifiedPunch[] {
    const machine: UnifiedPunch[] = [];
    for (const p of devicePunches) {
      if (!p.employeeId) continue; // unmapped — cannot attribute to an employee
      machine.push({
        id: p.id,
        employeeId: p.employeeId,
        timestamp: p.punchTime,
        type: devicePunchType(p.punchType),
        source: "machine",
        sources: ["machine"],
        deduped: false,
        attendanceLogId: null,
        devicePunchId: p.id,
        notes: null,
        flaggedForReview: false,
        flagReason: null,
        withinGeofence: null,
        geofenceZoneName: null,
        faceMatchScore: null,
        livenessScore: null,
        verifyType: p.verifyType ?? null,
        terminalAlias: p.terminalAlias ?? null,
        punchStateText: p.punchStateText ?? null,
      });
    }

    const app: UnifiedPunch[] = appLogs.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      timestamp: l.timestamp,
      type: appPunchType(l.notes),
      source: "app" as const,
      sources: ["app" as const],
      deduped: false,
      attendanceLogId: l.id,
      devicePunchId: null,
      notes: l.notes ?? null,
      flaggedForReview: Boolean(l.flaggedForReview),
      flagReason: l.flagReason ?? null,
      withinGeofence: l.withinGeofence ?? null,
      geofenceZoneName: l.geofenceZone?.name ?? null,
      faceMatchScore: l.faceMatchScore ?? null,
      livenessScore: l.livenessScore ?? null,
      verifyType: null,
      terminalAlias: null,
      punchStateText: null,
    }));

    // Greedy cross-source de-duplication: machine punches are the anchors.
    // Each machine punch absorbs at most one app punch (nearest in time).
    const matchedAppIds = new Set<string>();
    for (const m of machine) {
      if (m.type === "OTHER") continue;
      let best: UnifiedPunch | null = null;
      let bestDelta = Infinity;
      for (const a of app) {
        if (a.employeeId !== m.employeeId || a.type !== m.type) continue;
        if (a.flaggedForReview) continue; // flagged logs always stay visible
        if (matchedAppIds.has(a.id)) continue;
        const delta = Math.abs(a.timestamp.getTime() - m.timestamp.getTime());
        if (delta <= DEDUPE_WINDOW_MS && delta < bestDelta) {
          best = a;
          bestDelta = delta;
        }
      }
      if (best) {
        matchedAppIds.add(best.id);
        m.deduped = true;
        m.attendanceLogId = best.attendanceLogId;
        m.sources = ["machine", "app"];
        m.notes = best.notes;
        if (best.timestamp.getTime() < m.timestamp.getTime()) {
          m.timestamp = best.timestamp; // earlier of the pair wins
        }
      }
    }

    const merged = [
      ...machine,
      ...app.filter((a) => !matchedAppIds.has(a.id)),
    ];
    merged.sort((x, y) => x.timestamp.getTime() - y.timestamp.getTime());
    return merged;
  }

  /** Fetch both tables for a range and merge. Omit employeeIds for all staff. */
  static async getUnifiedPunches(opts: {
    employeeIds?: string[];
    start: Date;
    end: Date;
  }): Promise<UnifiedPunch[]> {
    const { employeeIds, start, end } = opts;
    const empFilter =
      employeeIds && employeeIds.length > 0
        ? { employeeId: { in: employeeIds } }
        : {};
    const [appLogs, devicePunches] = await Promise.all([
      prisma.attendanceLog.findMany({
        where: { ...empFilter, timestamp: { gte: start, lte: end } },
        include: { geofenceZone: { select: { name: true } } },
        orderBy: { timestamp: "asc" },
      }),
      prisma.devicePunch.findMany({
        where: {
          employeeId: employeeIds && employeeIds.length > 0 ? { in: employeeIds } : { not: null },
          punchTime: { gte: start, lte: end },
        },
        orderBy: { punchTime: "asc" },
      }),
    ]);
    return UnifiedAttendanceService.mergePunches(appLogs, devicePunches);
  }

  /** Group merged punches into per-employee, per-Pakistan-day records. */
  static groupIntoDays(punches: UnifiedPunch[]): UnifiedAttendanceDay[] {
    const byKey = new Map<string, UnifiedPunch[]>();
    for (const p of punches) {
      const key = `${p.employeeId}|${localDateKey(p.timestamp)}`;
      const list = byKey.get(key);
      if (list) list.push(p);
      else byKey.set(key, [p]);
    }
    const days: UnifiedAttendanceDay[] = [];
    for (const [key, list] of byKey) {
      const [employeeId, date] = key.split("|");
      const sorted = [...list].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
      const sources: UnifiedPunchSource[] = [];
      for (const p of sorted) {
        for (const s of p.sources) {
          if (!sources.includes(s)) sources.push(s);
        }
      }
      days.push({
        employeeId,
        date,
        present: sorted.length > 0,
        firstCheckIn: sorted.find((p) => p.type === "CHECK_IN") ?? null,
        lastCheckOut:
          [...sorted].reverse().find((p) => p.type === "CHECK_OUT") ?? null,
        punches: sorted,
        sources,
      });
    }
    days.sort((a, b) =>
      a.employeeId === b.employeeId
        ? a.date.localeCompare(b.date)
        : a.employeeId.localeCompare(b.employeeId)
    );
    return days;
  }

  static async getUnifiedDays(opts: {
    employeeIds?: string[];
    start: Date;
    end: Date;
  }): Promise<UnifiedAttendanceDay[]> {
    const punches = await UnifiedAttendanceService.getUnifiedPunches(opts);
    return UnifiedAttendanceService.groupIntoDays(punches);
  }

  /**
   * Shape a machine-involved unified punch as an AttendanceLog-like history
   * entry for API payloads that historically carried AttendanceLog rows
   * (GET /api/attendance, payroll). The notes keep the "[CHECK_IN]" /
   * "[CHECK_OUT]" prefix convention so existing consumers that parse punch
   * type from notes keep working; `source`/`sources` carry the provenance.
   */
  static toHistoryEntry(p: UnifiedPunch): Record<string, any> {
    const detail = [
      p.punchStateText || "Device punch",
      p.verifyType,
      p.terminalAlias,
    ]
      .filter(Boolean)
      .join(" · ");
    const notes =
      p.notes ??
      (p.type === "OTHER" ? `[DEVICE] ${detail}` : `[${p.type}] ${detail}`);
    return {
      id: p.id,
      employeeId: p.employeeId,
      timestamp: p.timestamp,
      type: p.type,
      source: p.source,
      sources: p.sources,
      deduped: p.deduped,
      attendanceLogId: p.attendanceLogId,
      devicePunchId: p.devicePunchId,
      notes,
      result: "pass",
      faceMatchScore: p.faceMatchScore,
      livenessScore: p.livenessScore,
      lat: null,
      lng: null,
      deviceId: null,
      geofenceZoneId: null,
      geofenceZone: null,
      withinGeofence: p.withinGeofence,
      flaggedForReview: false,
      flagReason: null,
      flagResolvedAt: null,
      flagResolvedBy: null,
      flagResolutionNotes: null,
      verifyType: p.verifyType,
      terminalAlias: p.terminalAlias,
      punchStateText: p.punchStateText,
    };
  }

  /**
   * Merge device punches into a list of raw AttendanceLog rows (as returned
   * by Prisma) for history-style payloads: app rows pass through untouched
   * (plus a `source: "app"` marker), app rows that de-duplicated into a
   * machine punch are replaced by the merged entry, and machine punches are
   * appended as history entries. Result is sorted newest first.
   */
  static mergeIntoHistoryLogs<T extends AppPunchInput>(
    appLogs: T[],
    devicePunches: DevicePunchInput[]
  ): any[] {
    if (devicePunches.length === 0) {
      return appLogs.map((l) => ({ ...l, source: "app" as const }));
    }
    const unified = UnifiedAttendanceService.mergePunches(appLogs, devicePunches);
    const dedupedAppIds = new Set(
      unified
        .filter((p) => p.deduped && p.attendanceLogId)
        .map((p) => p.attendanceLogId as string)
    );
    const out: any[] = [];
    for (const l of appLogs) {
      if (!dedupedAppIds.has(l.id)) out.push({ ...l, source: "app" as const });
    }
    for (const p of unified) {
      if (p.devicePunchId) out.push(UnifiedAttendanceService.toHistoryEntry(p));
    }
    out.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return out;
  }
}
