import { AttendanceService } from "../src/lib/services/AttendanceService";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== RUNNING GEOFENCED ATTENDANCE VALIDATION TESTS ===\n");

  // 1. Create a dedicated test employee for isolated verification
  const testEmpEmail = `geo_test_${Date.now()}@workmanservices.pk`;
  const employee = await prisma.employee.create({
    data: {
      name: "Geofence Automated Tester",
      email: testEmpEmail,
      phone: `+92300${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: "technician",
      department: "Operations",
      active: true,
    },
  });

  let zone = await prisma.geofenceZone.findFirst({ where: { isActive: true } });
  if (!zone) {
    zone = await prisma.geofenceZone.create({
      data: {
        name: "Test HQ",
        lat: 31.5204,
        lng: 74.3587,
        radiusMeters: 300,
        isActive: true,
      },
    });
  }

  console.log(`Using Employee: ${employee.name} (${employee.id})`);
  console.log(`Using Zone: ${zone.name} at (${zone.lat}, ${zone.lng}) radius: ${zone.radiusMeters}m\n`);

  // TEST 1: Stale Timestamp Rejection (> 2 minutes old)
  console.log("TEST 1: Testing Stale Timestamp Rejection...");
  const staleTimestamp = new Date(Date.now() - 3 * 60 * 1000).toISOString(); // 3 mins ago
  const staleRes = await AttendanceService.validateAndRecordAttendance({
    employeeId: employee.id,
    geofenceZoneId: zone.id,
    lat: zone.lat,
    lng: zone.lng,
    timestamp: staleTimestamp,
    deviceId: "test-device-1",
  });
  console.log(`Result: status=${staleRes.status}, code=${staleRes.code}`);
  if (staleRes.status !== "rejected" || staleRes.code !== "STALE_PAYLOAD") {
    throw new Error(`Test 1 FAILED: Expected rejected due to STALE_PAYLOAD, got ${staleRes.status}`);
  }
  console.log("PASSED: Stale payload successfully rejected.\n");

  // TEST 2: Valid check-in inside geofence with fresh timestamp
  console.log("TEST 2: Testing Valid Punch Inside Geofence...");
  const freshRes = await AttendanceService.validateAndRecordAttendance({
    employeeId: employee.id,
    geofenceZoneId: zone.id,
    lat: zone.lat + 0.0001, // ~11 meters away
    lng: zone.lng,
    timestamp: new Date().toISOString(),
    deviceId: "test-device-1",
    notes: "Automated test punch inside zone",
  });
  console.log(`Result: status=${freshRes.status}, distance=${freshRes.distanceMeters}m, withinGeofence=${freshRes.withinGeofence}`);
  if (freshRes.status !== "accepted" || !freshRes.withinGeofence) {
    throw new Error(`Test 2 FAILED: Expected accepted inside geofence, got ${freshRes.status}`);
  }
  console.log("PASSED: Clean check-in recorded inside geofence.\n");

  // TEST 3: Punch outside geofence (should be accepted-but-flagged)
  console.log("TEST 3: Testing Punch Outside Geofence Perimeter...");
  const outsideRes = await AttendanceService.validateAndRecordAttendance({
    employeeId: employee.id,
    geofenceZoneId: zone.id,
    lat: zone.lat + 0.05, // ~5.5 km away
    lng: zone.lng,
    timestamp: new Date().toISOString(),
    deviceId: "test-device-1",
    notes: "Automated test punch outside zone",
  });
  console.log(`Result: status=${outsideRes.status}, flaggedForReview=${outsideRes.flaggedForReview}, flagReason=${outsideRes.flagReason}`);
  if (outsideRes.status !== "accepted-but-flagged" || !outsideRes.flaggedForReview) {
    throw new Error(`Test 3 FAILED: Expected accepted-but-flagged, got ${outsideRes.status}`);
  }
  console.log("PASSED: Outside geofence punch recorded and flagged for review.\n");

  // TEST 4: Implausible Travel Jump (> 150 km/h)
  console.log("TEST 4: Testing Implausible Velocity Jump (> 150 km/h)...");
  // Let's punch from Karachi (24.8607, 67.0011) 1 minute after previous punch in Dubai (~1200 km in 1 min -> ~72,000 km/h)
  const jumpRes = await AttendanceService.validateAndRecordAttendance({
    employeeId: employee.id,
    geofenceZoneId: zone.id,
    lat: 24.8607,
    lng: 67.0011,
    timestamp: new Date().toISOString(),
    deviceId: "test-device-1",
    notes: "Automated teleport jump test",
  });
  console.log(`Result: status=${jumpRes.status}, speed=${jumpRes.calculatedSpeedKmH} km/h, flagReason=${jumpRes.flagReason}`);
  if (jumpRes.status !== "accepted-but-flagged" || (jumpRes.calculatedSpeedKmH || 0) < 150) {
    throw new Error(`Test 4 FAILED: Expected velocity jump flag, got speed=${jumpRes.calculatedSpeedKmH}`);
  }
  console.log("PASSED: Implausible velocity jump detected and flagged.\n");

  // TEST 5: Resolve Flagged Log
  console.log("TEST 5: Testing Administrative Flag Resolution...");
  if (!jumpRes.log?.id) throw new Error("No log ID returned for jump test");
  const resolved = await AttendanceService.resolveFlaggedLog({
    logId: jumpRes.log.id,
    resolvedBy: "Audit Engineer",
    notes: "Test verified and dismissed by automated runner",
    action: "approve",
  });
  console.log(`Resolved Log ID: ${resolved.id}, flaggedForReview=${resolved.flaggedForReview}, result=${resolved.result}`);
  if (resolved.flaggedForReview !== false || resolved.result !== "pass") {
    throw new Error("Test 5 FAILED: Expected flaggedForReview=false and result=pass");
  }
  console.log("Cleaning up test records...");
  await prisma.attendanceLog.deleteMany({ where: { employeeId: employee.id } });
  await prisma.employee.delete({ where: { id: employee.id } });
  console.log("Cleanup complete.\n");

  console.log("=== ALL GEOFENCE ATTENDANCE VALIDATION TESTS PASSED ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
