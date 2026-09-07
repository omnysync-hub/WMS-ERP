import { prisma } from "@/lib/prisma";

export interface AttendanceCheckParams {
  employeeId: string;
  faceMatchScore: number; // e.g. 0 to 100
  lat: number;
  lng: number;
  notes?: string;
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
   * Check in / Check out employee:
   * Rule: Must have faceMatchScore >= 90 AND must be within a registered geofence_zone radius.
   * Logs BOTH PASS and FAIL attempts for dispute resolution audit trail.
   */
  static async recordAttendance(params: AttendanceCheckParams) {
    const { employeeId, faceMatchScore, lat, lng, notes } = params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) throw new Error("Employee not found");

    // Fetch all geofence zones
    const zones = await prisma.geofenceZone.findMany();
    let matchingZone = null;
    let minDistance = Infinity;

    for (const zone of zones) {
      const dist = this.calculateDistance(lat, lng, zone.lat, zone.lng);
      if (dist <= zone.radiusMeters) {
        matchingZone = zone;
        break;
      }
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    const isFaceValid = faceMatchScore >= 90;
    const isGeofenceValid = matchingZone !== null;

    let result = "pass";
    let failureReason = "";

    if (!isFaceValid && !isGeofenceValid) {
      result = "fail";
      failureReason = `Face match score too low (${faceMatchScore}% < 90%) and outside geofence (nearest zone is ${Math.round(minDistance)}m away)`;
    } else if (!isFaceValid) {
      result = "fail";
      failureReason = `Face match score too low (${faceMatchScore}% < 90%)`;
    } else if (!isGeofenceValid) {
      result = "fail";
      failureReason = `Outside authorized geofence radius. Nearest zone is ${Math.round(minDistance)}m away (max allowed: 150m)`;
    }

    const log = await prisma.attendanceLog.create({
      data: {
        employeeId,
        faceMatchScore,
        lat,
        lng,
        geofenceZoneId: matchingZone?.id || null,
        result,
        notes: notes ? `${notes} | ${failureReason}` : failureReason || "Verification successful",
      },
      include: {
        employee: true,
        geofenceZone: true,
      },
    });

    // Update employee's last ping
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        lat,
        lng,
        lastPingAt: new Date(),
      },
    });

    return {
      success: result === "pass",
      result,
      failureReason,
      log,
      zoneName: matchingZone?.name || "Out of bounds",
    };
  }
}
