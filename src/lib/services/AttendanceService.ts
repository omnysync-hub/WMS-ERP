import { prisma } from "@/lib/prisma";

export interface AttendanceSubmissionPayload {
  employeeId: string;
  geofenceZoneId?: string; // claimed zone ID
  lat: number;
  lng: number;
  timestamp?: string | Date; // client-reported timestamp
  faceMatchScore?: number; // stub passthrough from mobile client
  livenessScore?: number; // anti-spoofing liveness metric (0.0 to 1.0)
  deviceId?: string;
  notes?: string;
}

export interface AttendanceVerificationResult {
  status: "accepted" | "accepted-but-flagged" | "rejected";
  code: string;
  message: string;
  log?: any;
  withinGeofence?: boolean;
  distanceMeters?: number;
  flaggedForReview?: boolean;
  flagReason?: string | null;
  calculatedSpeedKmH?: number | null;
  zoneName?: string;
  nearestZone?: {
    id: string;
    name: string;
    radiusMeters: number;
    distanceMeters: number;
  } | null;
}

export class AttendanceService {
  /**
   * Distance calculation using Haversine formula (in meters)
   */
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // meters
  }

  /**
   * Phase 1 Geofenced Attendance Validation:
   * 1. Rejects submissions with timestamp older than 2 mins from server receipt time.
   * 2. Independently recomputes geofence inclusion against claimed/active GeofenceZone coordinates & radius.
   * 3. Flags implausible location jumps (speed > 150 km/h compared to prior log).
   * 4. Logs full record into AttendanceLog with audit status.
   */
  static async validateAndRecordAttendance(
    params: AttendanceSubmissionPayload
  ): Promise<AttendanceVerificationResult> {
    const {
      employeeId,
      geofenceZoneId,
      lat,
      lng,
      timestamp: clientTimestamp,
      faceMatchScore,
      livenessScore,
      deviceId = "unknown_device",
      notes,
    } = params;

    const serverReceiptTime = new Date();

    // 1. Employee existence check
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      return {
        status: "rejected",
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee does not exist or has been removed from ERP.",
      };
    }

    if (!employee.active) {
      return {
        status: "rejected",
        code: "EMPLOYEE_INACTIVE",
        message: "Employee profile is inactive or suspended. Cannot log attendance.",
      };
    }

    // 2. Stale / Replayed Payload Protection (Reject if > 2 minutes difference)
    if (clientTimestamp) {
      const parsedClientTime = new Date(clientTimestamp).getTime();
      if (isNaN(parsedClientTime)) {
        return {
          status: "rejected",
          code: "INVALID_TIMESTAMP",
          message: "Provided timestamp is not a valid ISO 8601 date string.",
        };
      }

      const diffMs = serverReceiptTime.getTime() - parsedClientTime;
      const MAX_SKEW_MS = 2 * 60 * 1000; // 2 minutes (120,000 ms)

      if (diffMs > MAX_SKEW_MS) {
        return {
          status: "rejected",
          code: "STALE_PAYLOAD",
          message: `Submission rejected: Client timestamp is ${Math.round(
            diffMs / 1000
          )} seconds older than server receipt time (max allowed: 120s). Stale or replayed submission.`,
        };
      }

      // Reject if timestamp is in the future by more than 2 minutes (clock tampering)
      if (diffMs < -MAX_SKEW_MS) {
        return {
          status: "rejected",
          code: "FUTURE_TIMESTAMP",
          message: `Submission rejected: Client timestamp is ${Math.round(
            Math.abs(diffMs) / 1000
          )} seconds in the future. Check device system clock.`,
        };
      }
    }

    // 3. Geofence — prefer staff-assigned sites; never trust client withinGeofence
    const assignments = await prisma.employeeGeofenceAssignment.findMany({
      where: { employeeId },
      include: { zone: true },
    });
    const assignedActive = assignments
      .map((a) => a.zone)
      .filter((z) => z && z.isActive);

    const allActiveZones = await prisma.geofenceZone.findMany({
      where: { isActive: true },
    });

    if (allActiveZones.length === 0) {
      return {
        status: "rejected",
        code: "NO_ACTIVE_ZONES",
        message: "No active geofence zones configured in ERP.",
      };
    }

    const scopedToAssignment = assignedActive.length > 0;
    const candidateZones = scopedToAssignment ? assignedActive : allActiveZones;

    let targetZone = null as (typeof candidateZones)[0] | null;
    let distanceToTarget = Infinity;

    // Claimed zone only counts if it is in the candidate set
    if (geofenceZoneId) {
      targetZone = candidateZones.find((z) => z.id === geofenceZoneId) || null;
      if (targetZone) {
        distanceToTarget = this.calculateDistance(lat, lng, targetZone.lat, targetZone.lng);
      }
    }

    let nearestZone = targetZone;
    let minDistance = distanceToTarget;

    for (const zone of candidateZones) {
      const dist = this.calculateDistance(lat, lng, zone.lat, zone.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestZone = zone;
      }
    }

    const evaluatedZone = targetZone || nearestZone;
    const evaluatedDistance = targetZone ? distanceToTarget : minDistance;
    const withinGeofence = evaluatedZone
      ? evaluatedDistance <= evaluatedZone.radiusMeters
      : false;

    // 4. Implausible Location Jump Check (> 150 km/h travel speed vs prior log)
    const priorLog = await prisma.attendanceLog.findFirst({
      where: { employeeId },
      orderBy: { timestamp: "desc" },
    });

    let jumpDetected = false;
    let calculatedSpeedKmH: number | null = null;
    let jumpReason: string | null = null;

    if (priorLog && priorLog.lat && priorLog.lng) {
      const timeDiffMs = Math.abs(serverReceiptTime.getTime() - priorLog.timestamp.getTime());
      const distanceMeters = this.calculateDistance(lat, lng, priorLog.lat, priorLog.lng);
      const distanceKm = distanceMeters / 1000;

      const effectiveHours = Math.max(timeDiffMs / (1000 * 60 * 60), 1 / 3600);
      calculatedSpeedKmH = Math.round(distanceKm / effectiveHours);

      if (distanceMeters > 100 && calculatedSpeedKmH > 150) {
        jumpDetected = true;
        const elapsedMins = Math.max(1, Math.round(timeDiffMs / (1000 * 60)));
        jumpReason = `Implausible travel speed detected: ${calculatedSpeedKmH} km/h (${distanceKm.toFixed(
          1
        )} km in ~${elapsedMins} min). Exceeds 150 km/h threshold — potential GPS spoofing or shared credentials.`;
      }
    }

    // 5. Evaluate flags
    let flaggedForReview = false;
    const flagReasons: string[] = [];

    if (jumpDetected && jumpReason) {
      flaggedForReview = true;
      flagReasons.push(jumpReason);
    }

    if (!scopedToAssignment) {
      flaggedForReview = true;
      flagReasons.push(
        "Staff is not assigned to any attendance site — matched nearest active zone. Assign sites in HRM → Attendance."
      );
    }

    if (!withinGeofence && evaluatedZone) {
      flaggedForReview = true;
      flagReasons.push(
        scopedToAssignment
          ? `Outside assigned site "${evaluatedZone.name}". Measured ${Math.round(
              evaluatedDistance
            )}m (allowed ${evaluatedZone.radiusMeters}m).`
          : `Outside authorized geofence radius. Measured ${Math.round(
              evaluatedDistance
            )}m from "${evaluatedZone.name}" (max radius: ${evaluatedZone.radiusMeters}m).`
      );
    }

    // Biometric floors — mobile must send real ONNX scores (0–100 match, 0–1 liveness)
    const match = Number(faceMatchScore);
    const live =
      livenessScore !== undefined && livenessScore !== null
        ? Number(livenessScore)
        : null;

    const notesLower = (notes || "").toLowerCase();
    const isPinOverride = notesLower.includes("pin_override");

    if (!isPinOverride) {
      if (live === null || Number.isNaN(live) || live < 0.88) {
        return {
          status: "rejected",
          code: "LIVENESS_FAILED",
          message:
            "Attendance rejected: face liveness score too low or missing. Spoof / photo attempts are not accepted.",
        };
      }
      // Accept either cosine (0–1) or percent (0–100) from older clients
      const match01 = match > 1 ? match / 100 : match;
      if (Number.isNaN(match01) || match01 < 0.72) {
        return {
          status: "rejected",
          code: "FACE_MATCH_FAILED",
          message:
            "Attendance rejected: face did not match the enrolled employee profile.",
        };
      }
    } else {
      flaggedForReview = true;
      flagReasons.push("PIN override used after face match exhaustion — HR review required.");
    }

    const flagReasonStr = flagReasons.length > 0 ? flagReasons.join(" | ") : null;

    // 6. Persist AttendanceLog with complete audit attributes
    const log = await prisma.attendanceLog.create({
      data: {
        employeeId,
        faceMatchScore: Number(faceMatchScore),
        livenessScore: livenessScore !== undefined && livenessScore !== null ? Number(livenessScore) : null,
        lat,
        lng,
        geofenceZoneId: evaluatedZone?.id || null,
        deviceId,
        withinGeofence,
        flaggedForReview,
        flagReason: flagReasonStr,
        result: flaggedForReview ? "flagged" : "pass",
        notes: notes ? `${notes}${flagReasonStr ? ` [Flag: ${flagReasonStr}]` : ""}` : flagReasonStr || "Verified",
        timestamp: clientTimestamp ? new Date(clientTimestamp) : serverReceiptTime,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
            designation: true,
          },
        },
        geofenceZone: true,
      },
    });

    // Update employee's last ping coordinates
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        lat,
        lng,
        lastPingAt: serverReceiptTime,
      },
    });

    // 7. Format structured return payload
    if (flaggedForReview) {
      return {
        status: "accepted-but-flagged",
        code: "FLAGGED_FOR_REVIEW",
        message: "Attendance punch logged but flagged for administrative review.",
        log,
        withinGeofence,
        distanceMeters: Math.round(evaluatedDistance),
        flaggedForReview: true,
        flagReason: flagReasonStr,
        calculatedSpeedKmH,
        zoneName: evaluatedZone?.name || "Unassigned Zone",
        nearestZone: evaluatedZone
          ? {
              id: evaluatedZone.id,
              name: evaluatedZone.name,
              radiusMeters: evaluatedZone.radiusMeters,
              distanceMeters: Math.round(evaluatedDistance),
            }
          : null,
      };
    }

    return {
      status: "accepted",
      code: "ACCEPTED",
      message: "Attendance verified and recorded successfully within authorized geofence.",
      log,
      withinGeofence: true,
      distanceMeters: Math.round(evaluatedDistance),
      flaggedForReview: false,
      flagReason: null,
      calculatedSpeedKmH,
      zoneName: evaluatedZone?.name || "Main Office",
      nearestZone: evaluatedZone
        ? {
            id: evaluatedZone.id,
            name: evaluatedZone.name,
            radiusMeters: evaluatedZone.radiusMeters,
            distanceMeters: Math.round(evaluatedDistance),
          }
        : null,
    };
  }

  /**
   * Resolve or dismiss a flagged attendance log
   */
  static async resolveFlaggedLog(params: {
    logId: string;
    resolvedBy: string;
    notes?: string;
    action: "approve" | "dismiss";
  }) {
    const { logId, resolvedBy, notes, action } = params;

    const existing = await prisma.attendanceLog.findUnique({
      where: { id: logId },
    });
    if (!existing) throw new Error("Attendance log not found");

    const resolutionNotes = `[${action.toUpperCase()}] ${notes || "Resolved by administrator"}`;

    const updated = await prisma.attendanceLog.update({
      where: { id: logId },
      data: {
        flaggedForReview: false,
        flagResolvedAt: new Date(),
        flagResolvedBy: resolvedBy,
        flagResolutionNotes: resolutionNotes,
        result: action === "approve" ? "pass" : "dismissed",
      },
      include: {
        employee: true,
        geofenceZone: true,
      },
    });

    return updated;
  }

  /**
   * Fetch flagged attendance logs pending administrative review
   */
  static async getFlaggedLogs(take = 50) {
    return prisma.attendanceLog.findMany({
      where: { flaggedForReview: true },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            role: true,
            department: true,
            designation: true,
          },
        },
        geofenceZone: true,
      },
      orderBy: { timestamp: "desc" },
      take,
    });
  }

  /**
   * Legacy adapter for backward compatibility with existing tests/mock runners
   */
  static async recordAttendance(params: any) {
    const res = await this.validateAndRecordAttendance({
      employeeId: params.employeeId,
      lat: params.lat,
      lng: params.lng,
      faceMatchScore: params.faceMatchScore,
      notes: params.notes,
    });

    return {
      success: res.status === "accepted",
      result: res.status === "accepted" ? "pass" : "fail",
      failureReason: res.flagReason || res.message,
      log: res.log,
      zoneName: res.zoneName || "Out of bounds",
    };
  }
}
