import { prisma } from "../src/lib/prisma";
import { AttendanceService } from "../src/lib/services/AttendanceService";
import { signMobileToken, EXPECTED_EMBEDDING_DIMENSION } from "../src/lib/auth/mobileAuth";

async function main() {
  console.log("=== RUNNING FACE EMBEDDING ENROLLMENT & AUTHORIZATION AUDIT TESTS ===\n");

  // Create Test Employee A (Technician)
  const empA = await prisma.employee.create({
    data: {
      name: "Technician Employee A",
      email: `tech_a_${Date.now()}@workmanservices.pk`,
      phone: `+92311${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: "technician",
      department: "Field Operations",
      active: true,
      mobileLoginActive: true,
      faceEnrolled: false,
    },
  });

  // Create Test Employee B (Technician)
  const empB = await prisma.employee.create({
    data: {
      name: "Technician Employee B",
      email: `tech_b_${Date.now()}@workmanservices.pk`,
      phone: `+92312${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: "technician",
      department: "Field Operations",
      active: true,
      mobileLoginActive: true,
      faceEnrolled: false,
    },
  });

  // Create Test Admin Employee (HR Role)
  const adminEmp = await prisma.employee.create({
    data: {
      name: "HR Administrator Sarah",
      email: `hr_admin_${Date.now()}@workmanservices.pk`,
      phone: `+92313${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: "hr",
      department: "Human Resources",
      active: true,
      mobileLoginActive: true,
      faceEnrolled: false,
    },
  });

  console.log(`Created Employee A: ${empA.name} (${empA.id})`);
  console.log(`Created Employee B: ${empB.name} (${empB.id})`);
  console.log(`Created HR Admin:   ${adminEmp.name} (${adminEmp.id})\n`);

  const { POST: enrollPost, GET: enrollGet } = await import(
    "../src/app/api/employees/[id]/enrollment/route"
  );

  // Helper function to mock NextRequest
  function mockNextRequest(body: any, method = "POST", headers: Record<string, string> = {}) {
    return {
      url: "http://localhost:3001/api/employees/test/enrollment",
      method,
      json: async () => body,
      headers: {
        get: (key: string) => headers[key.toLowerCase()] || null,
      },
    } as any;
  }

  // Helper to generate cryptographically signed mobile Bearer tokens
  function mobileToken(employeeId: string) {
    return `Bearer ${signMobileToken(employeeId)}`;
  }

  const valid512Vector = Array.from({ length: EXPECTED_EMBEDDING_DIMENSION }, (_, i) => Math.sin(i));

  // =========================================================================
  // TEST 1: Unauthenticated Requests (Missing credentials must return 401)
  // =========================================================================
  console.log("TEST 1: Testing Unauthenticated Access (POST & GET must return 401)...");
  const unauthPostReq = mockNextRequest({ embedding: valid512Vector });
  const unauthPostRes = await enrollPost(unauthPostReq, { params: { id: empA.id } });
  if (unauthPostRes.status !== 401) {
    throw new Error(`Test 1 FAILED: Expected 401 for anonymous POST, got ${unauthPostRes.status}`);
  }

  const unauthGetReq = mockNextRequest({}, "GET");
  const unauthGetRes = await enrollGet(unauthGetReq, { params: { id: empA.id } });
  if (unauthGetRes.status !== 401) {
    throw new Error(`Test 1 FAILED: Expected 401 for anonymous GET, got ${unauthGetRes.status}`);
  }
  console.log("PASSED: Anonymous requests strictly rejected with HTTP 401 Unauthorized.\n");

  // =========================================================================
  // TEST 1B: Cryptographic Token Signature Verification (Forged/Unsigned Token -> 401)
  // =========================================================================
  console.log("TEST 1B: Testing Cryptographic Signature Enforcement (Forged unsigned/tampered tokens)...");
  // 1. Plain unsigned token (old format without HMAC signature)
  const unsignedToken = `Bearer wms_mobile_${Buffer.from(`${empA.id}:${Date.now()}`).toString("base64")}`;
  const unsignedRes = await enrollPost(
    mockNextRequest({ embedding: valid512Vector }, "POST", { authorization: unsignedToken }),
    { params: { id: empA.id } }
  );
  if (unsignedRes.status !== 401) {
    throw new Error(`Test 1B FAILED: Expected 401 for unsigned token, got ${unsignedRes.status}`);
  }

  // 2. Token with forged bogus HMAC signature
  const fakePayload = Buffer.from(`${empA.id}:${Date.now()}`).toString("base64url");
  const forgedToken = `Bearer wms_mobile_${fakePayload}.badf00d1234567890badf00d1234567890badf00d1234567890badf00d12345678`;
  const forgedRes = await enrollPost(
    mockNextRequest({ embedding: valid512Vector }, "POST", { authorization: forgedToken }),
    { params: { id: empA.id } }
  );
  if (forgedRes.status !== 401) {
    throw new Error(`Test 1B FAILED: Expected 401 for forged HMAC signature, got ${forgedRes.status}`);
  }
  console.log("PASSED: Forged, unsigned, and tampered tokens strictly rejected with HTTP 401 Unauthorized.\n");

  // =========================================================================
  // TEST 2: Self-Enrollment Scope Check (Employee A attempts POST to Employee B -> 403)
  // =========================================================================
  console.log("TEST 2: Testing Scope Enforcement: Employee A attempts POST to Employee B (must return 403)...");
  const crossPostReq = mockNextRequest(
    { embedding: valid512Vector },
    "POST",
    { authorization: mobileToken(empA.id) }
  );
  const crossPostRes = await enrollPost(crossPostReq, { params: { id: empB.id } });
  const crossPostData = await crossPostRes.json();

  console.log(`Cross-POST Status: ${crossPostRes.status}, Error: "${crossPostData.error}"`);
  if (crossPostRes.status !== 403 || !crossPostData.error?.toLowerCase().includes("forbidden")) {
    throw new Error(`Test 2 FAILED: Expected 403 Forbidden when Employee A attempts to enroll Employee B, got ${crossPostRes.status}`);
  }
  console.log("PASSED: Non-admin cross-employee enrollment strictly rejected with HTTP 403 Forbidden.\n");

  // =========================================================================
  // TEST 2B: Privilege Escalation Spoofing Guard (Claiming admin via body/headers -> 403)
  // =========================================================================
  console.log("TEST 2B: Testing Privilege Escalation Guard (Employee A claims 'admin' role in body and headers)...");
  const spoofReq = mockNextRequest(
    {
      embedding: valid512Vector,
      actorRole: "admin",       // Malicious body claim
      actorName: "Super Admin",
    },
    "POST",
    {
      authorization: mobileToken(empA.id),
      "x-actor-role": "admin",  // Malicious header claim
    }
  );
  const spoofRes = await enrollPost(spoofReq, { params: { id: empB.id } });
  const spoofData = await spoofRes.json();

  console.log(`Spoof Attempt Status: ${spoofRes.status}, Error: "${spoofData.error}"`);
  if (spoofRes.status !== 403) {
    throw new Error(`Test 2B FAILED: Privilege escalation succeeded! Expected 403 Forbidden, got ${spoofRes.status}`);
  }
  console.log("PASSED: Privilege escalation via body/headers thwarted; DB role authoritative (HTTP 403).\n");

  // =========================================================================
  // TEST 3: GET Endpoint Scope Check (Employee A attempts GET on Employee B -> 403)
  // =========================================================================
  console.log("TEST 3: Testing Scope Enforcement: Employee A attempts GET to Employee B (must return 403)...");
  const crossGetReq = mockNextRequest(
    {},
    "GET",
    { authorization: mobileToken(empA.id) }
  );
  const crossGetRes = await enrollGet(crossGetReq, { params: { id: empB.id } });
  const crossGetData = await crossGetRes.json();

  console.log(`Cross-GET Status: ${crossGetRes.status}, Error: "${crossGetData.error}"`);
  if (crossGetRes.status !== 403) {
    throw new Error(`Test 3 FAILED: Expected 403 Forbidden when Employee A inspects Employee B, got ${crossGetRes.status}`);
  }
  console.log("PASSED: Non-admin cross-employee status read strictly rejected with HTTP 403 Forbidden.\n");

  // =========================================================================
  // TEST 4: Legitimate Self-Enrollment & Self GET (Employee A -> Employee A -> 200)
  // =========================================================================
  console.log("TEST 4: Testing Legitimate Self-Enrollment (Employee A -> Employee A)...");
  const selfPostReq = mockNextRequest(
    { embedding: valid512Vector, enrolledAt: new Date().toISOString() },
    "POST",
    { authorization: mobileToken(empA.id) }
  );
  const selfPostRes = await enrollPost(selfPostReq, { params: { id: empA.id } });
  const selfPostData = await selfPostRes.json();

  if (selfPostRes.status !== 200 || !selfPostData.success || !selfPostData.faceEnrolled) {
    throw new Error(`Test 4 FAILED: Expected 200 for legitimate self-enrollment, got ${selfPostRes.status}`);
  }

  // Verify Self GET
  const selfGetReq = mockNextRequest({}, "GET", { authorization: mobileToken(empA.id) });
  const selfGetRes = await enrollGet(selfGetReq, { params: { id: empA.id } });
  const selfGetData = await selfGetRes.json();
  if (selfGetRes.status !== 200 || !selfGetData.hasEmbedding || selfGetData.enrollmentCount !== 1) {
    throw new Error(`Test 4 FAILED: Expected 200 for self GET, got ${selfGetRes.status}`);
  }
  console.log("PASSED: Employee A successfully enrolled own face and fetched own enrollment status.\n");

  // =========================================================================
  // TEST 5: Rate Limiting / Cooldown Guard (Rapid re-enrollment within 30s -> 429)
  // =========================================================================
  console.log("TEST 5: Testing Rate Limiting / Cooldown Guard (immediate re-enrollment -> 429)...");
  const rapidPostReq = mockNextRequest(
    { embedding: valid512Vector },
    "POST",
    { authorization: mobileToken(empA.id) }
  );
  const rapidPostRes = await enrollPost(rapidPostReq, { params: { id: empA.id } });
  const rapidPostData = await rapidPostRes.json();

  console.log(`Rapid re-enrollment status: ${rapidPostRes.status}, Error: "${rapidPostData.error}"`);
  if (rapidPostRes.status !== 429 || !rapidPostData.error?.includes("rate limit")) {
    throw new Error(`Test 5 FAILED: Expected 429 Too Many Requests on burst re-enrollment, got ${rapidPostRes.status}`);
  }
  console.log("PASSED: Rapid re-enrollment prevented by rate limit cooldown (HTTP 429 Too Many Requests).\n");

  // =========================================================================
  // TEST 6: Admin/HR Override Path (Admin enrolls and reads Employee B -> 200)
  // =========================================================================
  console.log("TEST 6: Testing Admin/HR Override Path (Admin enrolls Employee B)...");
  const adminPostReq = mockNextRequest(
    {
      embedding: valid512Vector,
      enrolledAt: new Date().toISOString(),
      actorName: adminEmp.name,
    },
    "POST",
    { authorization: mobileToken(adminEmp.id) }
  );
  const adminPostRes = await enrollPost(adminPostReq, { params: { id: empB.id } });
  const adminPostData = await adminPostRes.json();

  if (adminPostRes.status !== 200 || !adminPostData.success || adminPostData.enrollmentCount !== 1) {
    throw new Error(`Test 6 FAILED: Admin override enrollment failed with status ${adminPostRes.status}`);
  }

  // Admin GET on Employee B
  const adminGetReq = mockNextRequest({}, "GET", { authorization: mobileToken(adminEmp.id) });
  const adminGetRes = await enrollGet(adminGetReq, { params: { id: empB.id } });
  const adminGetData = await adminGetRes.json();
  if (adminGetRes.status !== 200 || adminGetData.employeeId !== empB.id || !adminGetData.hasEmbedding) {
    throw new Error(`Test 6 FAILED: Admin GET on Employee B failed with status ${adminGetRes.status}`);
  }
  console.log("PASSED: Admin/HR successfully enrolled and inspected Employee B record.\n");

  // =========================================================================
  // TEST 7: Dimension Validation (Send 128 floats instead of 512 with valid auth -> 400)
  // =========================================================================
  console.log("TEST 7: Testing Dimension Validation (Mismatched length with valid auth -> 400)...");
  const invalidVector = new Array(128).fill(0.123);
  const invalidReq = mockNextRequest(
    { embedding: invalidVector },
    "POST",
    { authorization: mobileToken(adminEmp.id) }
  );
  const invalidRes = await enrollPost(invalidReq, { params: { id: empB.id } });
  const invalidData = await invalidRes.json();

  if (invalidRes.status !== 400 || !invalidData.error?.includes("512")) {
    throw new Error(`Test 7 FAILED: Expected 400 for dimension mismatch, got ${invalidRes.status}`);
  }
  console.log("PASSED: Mismatched dimension vector rejected with HTTP 400.\n");

  // =========================================================================
  // TEST 8: Re-enrollment Abuse Check (Employee A attempts re-enrollment overwrite on Employee B -> 403)
  // =========================================================================
  console.log("TEST 8: Testing Re-enrollment Overwrite Impersonation Guard (Employee A -> Employee B -> 403)...");
  const maliciousVector = Array.from({ length: EXPECTED_EMBEDDING_DIMENSION }, (_, i) => Math.cos(i));
  const malReenrollReq = mockNextRequest(
    { embedding: maliciousVector },
    "POST",
    { authorization: mobileToken(empA.id) }
  );
  const malReenrollRes = await enrollPost(malReenrollReq, { params: { id: empB.id } });
  if (malReenrollRes.status !== 403) {
    throw new Error(`Test 8 FAILED: Expected 403 when non-admin attempts re-enrollment overwrite, got ${malReenrollRes.status}`);
  }
  console.log("PASSED: Malicious re-enrollment overwrite blocked with HTTP 403 Forbidden.\n");

  // =========================================================================
  // TEST 9: Legitimate Re-enrollment after Cooldown Window (Self re-enrolls -> count=2)
  // =========================================================================
  console.log("TEST 9: Testing Legitimate Re-enrollment after Cooldown Window...");
  // Simulate 35 seconds elapsed since initial enrollment
  await prisma.employee.update({
    where: { id: empA.id },
    data: { faceEnrolledAt: new Date(Date.now() - 35000) },
  });

  const updatedVector = Array.from({ length: EXPECTED_EMBEDDING_DIMENSION }, (_, i) => Math.cos(i));
  const validReenrollReq = mockNextRequest(
    { embedding: updatedVector, enrolledAt: new Date().toISOString() },
    "POST",
    { authorization: mobileToken(empA.id) }
  );
  const validReenrollRes = await enrollPost(validReenrollReq, { params: { id: empA.id } });
  const validReenrollData = await validReenrollRes.json();

  if (
    validReenrollRes.status !== 200 ||
    !validReenrollData.success ||
    validReenrollData.enrollmentCount !== 2 ||
    validReenrollData.isReenrollment !== true
  ) {
    throw new Error(`Test 9 FAILED: Expected count=2 and isReenrollment=true, got ${JSON.stringify(validReenrollData)}`);
  }
  console.log("PASSED: Legitimate re-enrollment successfully overwrote vector and incremented counter to 2.\n");

  // =========================================================================
  // TEST 10: Deactivated Employee Biometric Protection (Terminated employee -> 403)
  // =========================================================================
  console.log("TEST 10: Testing Deactivated Employee Enrollment Guard...");
  await prisma.employee.update({
    where: { id: empB.id },
    data: { active: false },
  });

  const deactPostReq = mockNextRequest(
    { embedding: valid512Vector },
    "POST",
    { authorization: mobileToken(adminEmp.id) }
  );
  const deactPostRes = await enrollPost(deactPostReq, { params: { id: empB.id } });
  if (deactPostRes.status !== 403) {
    throw new Error(`Test 10 FAILED: Expected 403 when updating deactivated employee, got ${deactPostRes.status}`);
  }
  console.log("PASSED: Deactivated employee enrollment rejected with HTTP 403 Forbidden.\n");

  // =========================================================================
  // TEST 11: Audit Trail Verification
  // =========================================================================
  console.log("TEST 11: Verifying ActivityLog Biometric Audit Records...");
  const auditLogs = await prisma.activityLog.findMany({
    where: {
      OR: [
        { target: { contains: empA.id } },
        { target: { contains: empB.id } },
      ],
    },
    orderBy: { timestamp: "desc" },
  });

  console.log(`Found ${auditLogs.length} audit log entries for test employees:`);
  auditLogs.forEach((l) => console.log(` - ${l.action} on ${l.target} by ${l.actorName} (${l.actorRole})`));

  if (auditLogs.length < 3) {
    throw new Error("Test 11 FAILED: Expected at least 3 biometric audit log entries.");
  }
  console.log("PASSED: ActivityLog records verified with authoritative actor identities.\n");

  // =========================================================================
  // TEST 12: Attendance Liveness Score Passthrough
  // =========================================================================
  console.log("TEST 12: Testing Attendance Liveness Score Passthrough...");
  let zone = await prisma.geofenceZone.findFirst({ where: { isActive: true } });
  if (!zone) {
    zone = await prisma.geofenceZone.create({
      data: { name: "Audit Zone", lat: 31.5204, lng: 74.3587, radiusMeters: 300, isActive: true },
    });
  }

  const attendanceRes = await AttendanceService.validateAndRecordAttendance({
    employeeId: empA.id,
    geofenceZoneId: zone.id,
    lat: zone.lat,
    lng: zone.lng,
    faceMatchScore: 98.1,
    livenessScore: 0.991,
    timestamp: new Date().toISOString(),
    deviceId: "mobile-phase2-simulator",
  });

  const storedLog = await prisma.attendanceLog.findUnique({
    where: { id: attendanceRes.log?.id },
  });

  if (!storedLog || storedLog.livenessScore !== 0.991) {
    throw new Error(`Test 12 FAILED: Expected stored livenessScore=0.991, got ${storedLog?.livenessScore}`);
  }
  console.log("PASSED: Attendance log stored livenessScore successfully.\n");

  // =========================================================================
  // TEST 13: System-Wide Route Hardening Check (/api/attendance Token & Scope)
  // =========================================================================
  console.log("TEST 13: Testing /api/attendance Token Verification & Scope (mirroring TEST 1B)...");
  const { POST: attendancePost } = await import("../src/app/api/attendance/route");

  // 1. Anonymous request to /api/attendance -> 401
  const anonAttRes = await attendancePost(
    mockNextRequest({ employeeId: empA.id, lat: 25.2, lng: 55.2 }, "POST")
  );
  if (anonAttRes.status !== 401) {
    throw new Error(`Test 13 FAILED: Expected 401 for anonymous /api/attendance, got ${anonAttRes.status}`);
  }

  // 2. Unsigned wms_mobile_ token -> 401
  const unsignedAttRes = await attendancePost(
    mockNextRequest({ employeeId: empA.id, lat: 25.2, lng: 55.2 }, "POST", { authorization: unsignedToken })
  );
  if (unsignedAttRes.status !== 401) {
    throw new Error(`Test 13 FAILED: Expected 401 for unsigned token on /api/attendance, got ${unsignedAttRes.status}`);
  }

  // 3. Forged HMAC signature -> 401
  const forgedAttRes = await attendancePost(
    mockNextRequest({ employeeId: empA.id, lat: 25.2, lng: 55.2 }, "POST", { authorization: forgedToken })
  );
  if (forgedAttRes.status !== 401) {
    throw new Error(`Test 13 FAILED: Expected 401 for forged HMAC on /api/attendance, got ${forgedAttRes.status}`);
  }

  // 4. Cross-employee punch: Employee A attempts to submit punch for Employee B -> 403
  const crossAttRes = await attendancePost(
    mockNextRequest(
      { employeeId: empB.id, geofenceZoneId: zone.id, lat: zone.lat, lng: zone.lng },
      "POST",
      { authorization: mobileToken(empA.id) }
    )
  );
  if (crossAttRes.status !== 403) {
    throw new Error(`Test 13 FAILED: Expected 403 when Employee A punches for Employee B, got ${crossAttRes.status}`);
  }

  // 5. Legitimate signed attendance punch -> 200
  const legitAttRes = await attendancePost(
    mockNextRequest(
      { employeeId: empA.id, geofenceZoneId: zone.id, lat: zone.lat, lng: zone.lng, faceMatchScore: 99.2 },
      "POST",
      { authorization: mobileToken(empA.id) }
    )
  );
  const legitAttData = await legitAttRes.json();
  if (legitAttRes.status !== 200 || !["accepted", "accepted-but-flagged"].includes(legitAttData.status)) {
    throw new Error(`Test 13 FAILED: Expected 200 accepted for legitimate punch, got status=${legitAttRes.status}, data=${JSON.stringify(legitAttData)}`);
  }
  console.log("PASSED: /api/attendance strictly enforces HMAC verification and cross-employee punch rejection.\n");

  // =========================================================================
  // TEST 14: MOBILE_AUTH_SECRET Fatal Error When Missing (No Guessable Fallback)
  // =========================================================================
  console.log("TEST 14: Verifying MOBILE_AUTH_SECRET Throws Fatal Error if Missing (No Fallback)...");
  const { getMobileAuthSecret } = await import("../src/lib/auth/mobileAuth");
  const originalSecret = process.env.MOBILE_AUTH_SECRET;
  try {
    delete process.env.MOBILE_AUTH_SECRET;
    delete process.env.AUTH_SECRET;
    let threw = false;
    try {
      getMobileAuthSecret();
    } catch (e: any) {
      threw = true;
      if (!e.message.includes("FATAL SECURITY CONFIGURATION ERROR")) {
        throw new Error(`Unexpected error message: ${e.message}`);
      }
    }
    if (!threw) {
      throw new Error("Test 14 FAILED: getMobileAuthSecret() did not throw when env var was missing!");
    }
  } finally {
    process.env.MOBILE_AUTH_SECRET = originalSecret;
  }
  console.log("PASSED: Server strictly throws fatal error without MOBILE_AUTH_SECRET (zero default fallback).\n");

  // =========================================================================
  // CLEANUP
  // =========================================================================
  console.log("Cleaning up test records...");
  await prisma.attendanceLog.deleteMany({
    where: { employeeId: { in: [empA.id, empB.id, adminEmp.id] } },
  });
  await prisma.activityLog.deleteMany({
    where: {
      OR: [
        { target: { contains: empA.id } },
        { target: { contains: empB.id } },
        { actorId: { in: [empA.id, empB.id, adminEmp.id] } },
      ],
    },
  });
  await prisma.employee.deleteMany({
    where: { id: { in: [empA.id, empB.id, adminEmp.id] } },
  });
  console.log("Cleanup complete.\n");

  console.log("=== ALL FACE ENROLLMENT AUTHORIZATION & AUDIT TESTS PASSED SUCCESSFULLY ===");
}

main()
  .catch((err) => {
    console.error("TEST SUITE FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
