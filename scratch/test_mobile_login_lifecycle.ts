import { prisma } from "../src/lib/prisma";
import { signMobileToken } from "../src/lib/auth/mobileAuth";

async function main() {
  console.log("=== RUNNING MOBILE LOGIN LIFECYCLE & SECURITY REGRESSION TESTS ===\n");

  const timestamp = Date.now();

  // Create Test Employee A (Field Technician)
  const empA = await prisma.employee.create({
    data: {
      name: `Technician Alpha ${timestamp}`,
      email: `tech_alpha_${timestamp}@workmanservices.pk`,
      phone: `+92311${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: "technician",
      department: "Field Operations",
      active: true,
      mobileLoginActive: false,
    },
  });

  // Create Test Employee B (Field Technician)
  const empB = await prisma.employee.create({
    data: {
      name: `Technician Bravo ${timestamp}`,
      email: `tech_bravo_${timestamp}@workmanservices.pk`,
      phone: `+92312${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: "technician",
      department: "Field Operations",
      active: true,
      mobileLoginActive: false,
    },
  });

  // Create Test HR Admin
  const adminEmp = await prisma.employee.create({
    data: {
      name: `HR Administrator ${timestamp}`,
      email: `hr_admin_${timestamp}@workmanservices.pk`,
      phone: `+92313${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: "hr",
      department: "Human Resources",
      active: true,
      mobileLoginActive: true,
    },
  });

  console.log(`Created Employee A: ${empA.name} (${empA.id})`);
  console.log(`Created Employee B: ${empB.name} (${empB.id})`);
  console.log(`Created HR Admin:   ${adminEmp.name} (${adminEmp.id})\n`);

  // Import route handlers
  const { POST: createLoginPost } = await import(
    "../src/app/api/employees/[id]/mobile-login/create/route"
  );
  const { POST: resetPinPost } = await import(
    "../src/app/api/employees/[id]/mobile-login/reset-pin/route"
  );
  const { POST: deactivatePost } = await import(
    "../src/app/api/employees/[id]/mobile-login/deactivate/route"
  );
  const { POST: reactivatePost } = await import(
    "../src/app/api/employees/[id]/mobile-login/reactivate/route"
  );
  const { GET: statusGet } = await import(
    "../src/app/api/employees/[id]/mobile-login/status/route"
  );
  const { POST: authPost } = await import(
    "../src/app/api/mobile/auth/route"
  );
  const { POST: changePinPost } = await import(
    "../src/app/api/mobile/auth/change-pin/route"
  );
  const { resolveCaller } = await import(
    "../src/lib/auth/mobileAuth"
  );

  // Helper to mock NextRequest
  function mockRequest(
    body: any = {},
    method = "POST",
    headers: Record<string, string> = {}
  ) {
    return {
      url: "http://localhost:3001/api/test",
      method,
      json: async () => body,
      headers: {
        get: (key: string) => headers[key.toLowerCase()] || null,
      },
    } as any;
  }

  function adminHeaders() {
    return {
      "x-employee-id": adminEmp.id,
      "x-actor-role": "hr",
    };
  }

  function mobileTokenHeader(employeeId: string) {
    return {
      authorization: `Bearer ${signMobileToken(employeeId)}`,
    };
  }

  try {
    // =========================================================================
    // TEST 1: Unauthorized Creation Attempt (Non-Admin Employee A -> 403)
    // =========================================================================
    console.log("TEST 1: Testing Non-Admin Creation Guard (Employee A attempts to create login for B -> 403)...");
    const unauthCreateRes = await createLoginPost(
      mockRequest({}, "POST", { "x-employee-id": empA.id, "x-actor-role": "technician" }),
      { params: { id: empB.id } }
    );
    if (unauthCreateRes.status !== 403) {
      throw new Error(`Test 1 FAILED: Expected 403 for non-admin creation, got ${unauthCreateRes.status}`);
    }
    console.log("PASSED: Non-admin creation blocked with HTTP 403.\n");

    // =========================================================================
    // TEST 2: Anonymous Creation Attempt (Missing credentials -> 401)
    // =========================================================================
    console.log("TEST 2: Testing Anonymous Creation Guard (Missing auth headers -> 401)...");
    const anonRes = await createLoginPost(mockRequest(), { params: { id: empA.id } });
    if (anonRes.status !== 401) {
      throw new Error(`Test 2 FAILED: Expected 401 for anonymous creation, got ${anonRes.status}`);
    }
    console.log("PASSED: Anonymous creation strictly rejected with HTTP 401.\n");

    // =========================================================================
    // TEST 3: Legitimate Mobile Login Creation by HR Admin
    // =========================================================================
    console.log("TEST 3: Testing Admin Creation (Admin provisions Employee A)...");
    const createRes = await createLoginPost(
      mockRequest({}, "POST", adminHeaders()),
      { params: { id: empA.id } }
    );
    const createData = await createRes.json();

    if (createRes.status !== 200 || !createData.success || !createData.tempPin) {
      throw new Error(`Test 3 FAILED: Expected 200 with tempPin, got status ${createRes.status}, data: ${JSON.stringify(createData)}`);
    }

    const firstTempPin = createData.tempPin;
    if (!/^\d{6}$/.test(firstTempPin)) {
      throw new Error(`Test 3 FAILED: Expected 6-digit numeric tempPin, got "${firstTempPin}"`);
    }

    const empInDbAfterCreate = await prisma.employee.findUnique({
      where: { id: empA.id },
    });
    if (
      !empInDbAfterCreate?.mobileLoginActive ||
      !empInDbAfterCreate?.mustResetPinOnNextLogin ||
      !empInDbAfterCreate?.mobilePinHash ||
      empInDbAfterCreate.failedLoginAttempts !== 0
    ) {
      throw new Error("Test 3 FAILED: Database fields not correctly set after mobile login creation.");
    }
    console.log(`PASSED: Admin successfully created mobile login. One-time tempPin generated: ${firstTempPin}.\n`);

    // =========================================================================
    // TEST 4: Duplicate Creation Rejection (Already Active -> 400)
    // =========================================================================
    console.log("TEST 4: Testing Duplicate Creation Guard (Re-create while active -> 400)...");
    const dupCreateRes = await createLoginPost(
      mockRequest({}, "POST", adminHeaders()),
      { params: { id: empA.id } }
    );
    if (dupCreateRes.status !== 400) {
      throw new Error(`Test 4 FAILED: Expected 400 for duplicate creation, got ${dupCreateRes.status}`);
    }
    console.log("PASSED: Duplicate creation rejected with HTTP 400 (admin must use reset-pin instead).\n");

    // =========================================================================
    // TEST 5: Status Endpoint Security & Exclusion of mobilePinHash
    // =========================================================================
    console.log("TEST 5: Testing Status Endpoint (Ensures mobilePinHash is NEVER returned)...");
    const statusRes = await statusGet(
      mockRequest({}, "GET", adminHeaders()),
      { params: { id: empA.id } }
    );
    const statusData = await statusRes.json();

    if (
      statusRes.status !== 200 ||
      statusData.mobileLoginActive !== true ||
      statusData.mustResetPinOnNextLogin !== true ||
      "mobilePinHash" in statusData
    ) {
      throw new Error(`Test 5 FAILED: Status invalid or leaked mobilePinHash! Data: ${JSON.stringify(statusData)}`);
    }

    // Non-admin stranger inspection -> 403
    const strangerStatusRes = await statusGet(
      mockRequest({}, "GET", { "x-employee-id": empB.id, "x-actor-role": "technician" }),
      { params: { id: empA.id } }
    );
    if (strangerStatusRes.status !== 403) {
      throw new Error(`Test 5 FAILED: Stranger was able to inspect status, expected 403, got ${strangerStatusRes.status}`);
    }
    console.log("PASSED: Status endpoint verified; hash strictly protected.\n");

    // =========================================================================
    // TEST 6: Mobile Login with Missing PIN -> 400
    // =========================================================================
    console.log("TEST 6: Testing Mobile Auth Missing PIN Validation -> 400...");
    const missingPinRes = await authPost(
      mockRequest({ employeeId: empA.id })
    );
    if (missingPinRes.status !== 400) {
      throw new Error(`Test 6 FAILED: Expected 400 when PIN is omitted, got ${missingPinRes.status}`);
    }
    console.log("PASSED: Missing PIN rejected with HTTP 400.\n");

    // =========================================================================
    // TEST 7: Mobile Login with Incorrect PIN -> 401 & Counter Increment
    // =========================================================================
    console.log("TEST 7: Testing Incorrect PIN Login -> 401 & failedLoginAttempts increment...");
    const wrongPinRes = await authPost(
      mockRequest({ employeeId: empA.id, pin: "000000" })
    );
    const wrongPinData = await wrongPinRes.json();
    if (wrongPinRes.status !== 401 || wrongPinData.remainingAttempts !== 4) {
      throw new Error(`Test 7 FAILED: Expected 401 with remainingAttempts=4, got status ${wrongPinRes.status}`);
    }

    const empAfterFailedAttempt = await prisma.employee.findUnique({
      where: { id: empA.id },
      select: { failedLoginAttempts: true },
    });
    if (empAfterFailedAttempt?.failedLoginAttempts !== 1) {
      throw new Error(`Test 7 FAILED: Expected failedLoginAttempts=1, got ${empAfterFailedAttempt?.failedLoginAttempts}`);
    }
    console.log("PASSED: Wrong PIN rejected; attempt counter correctly incremented.\n");

    // =========================================================================
    // TEST 8: Brute-Force Lockout after 5 Failed Attempts -> 401 isLocked + subsequent 423
    // =========================================================================
    console.log("TEST 8: Testing Brute-Force Lockout Enforcement (Simulating 4 more failures)...");
    for (let i = 2; i <= 4; i++) {
      await authPost(mockRequest({ employeeId: empA.id, pin: "999999" }));
    }

    // 5th attempt: should trigger lockout
    const lockTriggerRes = await authPost(mockRequest({ employeeId: empA.id, pin: "999999" }));
    const lockTriggerData = await lockTriggerRes.json();
    if (lockTriggerRes.status !== 401 || !lockTriggerData.isLocked) {
      throw new Error(`Test 8 FAILED: Expected 5th failure to trigger isLocked, got ${JSON.stringify(lockTriggerData)}`);
    }

    // Subsequent attempt while locked -> 423 Locked
    const whileLockedRes = await authPost(mockRequest({ employeeId: empA.id, pin: firstTempPin }));
    if (whileLockedRes.status !== 423) {
      throw new Error(`Test 8 FAILED: Expected 423 Locked on subsequent login while locked, got ${whileLockedRes.status}`);
    }
    console.log("PASSED: Account locked out after 5 failures; further login attempts strictly blocked (HTTP 423).\n");

    // =========================================================================
    // TEST 9: Admin PIN Reset Clears Lockout & Generates New Temp PIN
    // =========================================================================
    console.log("TEST 9: Testing Admin PIN Reset (Clears lockout & returns new temp PIN)...");
    const resetRes = await resetPinPost(
      mockRequest({}, "POST", adminHeaders()),
      { params: { id: empA.id } }
    );
    const resetData = await resetRes.json();
    if (resetRes.status !== 200 || !resetData.tempPin) {
      throw new Error(`Test 9 FAILED: Reset failed with status ${resetRes.status}`);
    }

    const newTempPin = resetData.tempPin;
    const empAfterReset = await prisma.employee.findUnique({
      where: { id: empA.id },
    });
    if (empAfterReset?.lockedUntil !== null || empAfterReset?.failedLoginAttempts !== 0 || !empAfterReset?.mustResetPinOnNextLogin) {
      throw new Error("Test 9 FAILED: Reset PIN did not clear lockout or failedLoginAttempts.");
    }
    console.log(`PASSED: Admin reset PIN cleared lockout; new tempPin: ${newTempPin}.\n`);

    // =========================================================================
    // TEST 10: Successful Login with Temp PIN & mustResetPinOnNextLogin Flag
    // =========================================================================
    console.log("TEST 10: Testing Login with New Temp PIN -> 200 & mustResetPinOnNextLogin=true...");
    const loginRes = await authPost(
      mockRequest({ employeeId: empA.id, pin: newTempPin })
    );
    const loginData = await loginRes.json();

    if (
      loginRes.status !== 200 ||
      !loginData.success ||
      !loginData.token ||
      loginData.mustResetPinOnNextLogin !== true
    ) {
      throw new Error(`Test 10 FAILED: Expected successful login with token and mustResetPinOnNextLogin=true, got: ${JSON.stringify(loginData)}`);
    }

    const sessionToken = loginData.token;
    console.log("PASSED: Employee A logged in successfully. Received session token and forced-reset flag.\n");

    // =========================================================================
    // TEST 11: Self-Service PIN Change (/api/mobile/auth/change-pin)
    // =========================================================================
    console.log("TEST 11: Testing Self-Service PIN Change...");
    // 1. Wrong current PIN -> 401
    const wrongCurrentRes = await changePinPost(
      mockRequest(
        { currentPin: "000000", newPin: "654321" },
        "POST",
        { authorization: `Bearer ${sessionToken}` }
      )
    );
    if (wrongCurrentRes.status !== 401) {
      throw new Error(`Test 11 FAILED: Expected 401 for wrong currentPin, got ${wrongCurrentRes.status}`);
    }

    // 2. Invalid new PIN format (letters) -> 400
    const invalidFormatRes = await changePinPost(
      mockRequest(
        { currentPin: newTempPin, newPin: "not-digits" },
        "POST",
        { authorization: `Bearer ${sessionToken}` }
      )
    );
    if (invalidFormatRes.status !== 400) {
      throw new Error(`Test 11 FAILED: Expected 400 for non-numeric PIN, got ${invalidFormatRes.status}`);
    }

    // 3. Legitimate PIN change: set to "789123"
    const validChangeRes = await changePinPost(
      mockRequest(
        { currentPin: newTempPin, newPin: "789123" },
        "POST",
        { authorization: `Bearer ${sessionToken}` }
      )
    );
    const validChangeData = await validChangeRes.json();
    if (validChangeRes.status !== 200 || !validChangeData.success || validChangeData.mustResetPinOnNextLogin !== false) {
      throw new Error(`Test 11 FAILED: Legitimate PIN change failed: ${JSON.stringify(validChangeData)}`);
    }

    const empAfterChange = await prisma.employee.findUnique({
      where: { id: empA.id },
    });
    if (empAfterChange?.mustResetPinOnNextLogin !== false) {
      throw new Error("Test 11 FAILED: mustResetPinOnNextLogin was not cleared after PIN change.");
    }
    console.log("PASSED: Employee A successfully changed PIN; mustResetPinOnNextLogin is now false.\n");

    // =========================================================================
    // TEST 12: Login Verification with Established PIN
    // =========================================================================
    console.log("TEST 12: Testing Login with New Established PIN vs Old Temp PIN...");
    // Old temp PIN must fail
    const oldLoginRes = await authPost(
      mockRequest({ employeeId: empA.id, pin: newTempPin })
    );
    if (oldLoginRes.status !== 401) {
      throw new Error(`Test 12 FAILED: Expected old temp PIN to fail, got ${oldLoginRes.status}`);
    }

    // New PIN must succeed with mustResetPinOnNextLogin=false
    const newLoginRes = await authPost(
      mockRequest({ employeeId: empA.id, pin: "789123" })
    );
    const newLoginData = await newLoginRes.json();
    if (newLoginRes.status !== 200 || newLoginData.mustResetPinOnNextLogin !== false) {
      throw new Error(`Test 12 FAILED: New PIN login failed: ${JSON.stringify(newLoginData)}`);
    }
    const activeToken = newLoginData.token;
    console.log("PASSED: Old temp PIN rejected; new PIN succeeded with mustResetPinOnNextLogin=false.\n");

    // =========================================================================
    // TEST 13: Deactivation & Immediate Mobile Bearer Token Invalidation
    // =========================================================================
    console.log("TEST 13: Testing Deactivation & Immediate Token Invalidation...");
    // Verify token works before deactivation
    const preCaller = await resolveCaller(mockRequest({}, "GET", { authorization: `Bearer ${activeToken}` }));
    if (!preCaller || preCaller.id !== empA.id) {
      throw new Error("Test 13 FAILED: Active token failed to resolve before deactivation.");
    }

    // Admin deactivates mobile access
    const deactRes = await deactivatePost(
      mockRequest({}, "POST", adminHeaders()),
      { params: { id: empA.id } }
    );
    if (deactRes.status !== 200) {
      throw new Error(`Test 13 FAILED: Deactivation failed with status ${deactRes.status}`);
    }

    // Invalidation check: resolveCaller() with the active token MUST NOW RETURN NULL immediately
    const postCaller = await resolveCaller(mockRequest({}, "GET", { authorization: `Bearer ${activeToken}` }));
    if (postCaller !== null) {
      throw new Error("Test 13 FAILED: Deactivated employee's existing token was still resolved by resolveCaller()!");
    }

    // Login attempt to /api/mobile/auth must be rejected with 403 deactivated
    const deactLoginRes = await authPost(mockRequest({ employeeId: empA.id, pin: "789123" }));
    if (deactLoginRes.status !== 403) {
      throw new Error(`Test 13 FAILED: Expected 403 for deactivated employee login, got ${deactLoginRes.status}`);
    }
    console.log("PASSED: Deactivation immediately invalidated existing token and blocked new logins (HTTP 403).\n");

    // =========================================================================
    // TEST 14: Reactivation Restores Access without PIN Reset
    // =========================================================================
    console.log("TEST 14: Testing Reactivation (Restores access with existing PIN)...");
    const reactRes = await reactivatePost(
      mockRequest({}, "POST", adminHeaders()),
      { params: { id: empA.id } }
    );
    if (reactRes.status !== 200) {
      throw new Error(`Test 14 FAILED: Reactivation failed with status ${reactRes.status}`);
    }

    // Login with existing PIN "789123" succeeds
    const reactLoginRes = await authPost(mockRequest({ employeeId: empA.id, pin: "789123" }));
    const reactLoginData = await reactLoginRes.json();
    if (reactLoginRes.status !== 200 || !reactLoginData.success) {
      throw new Error(`Test 14 FAILED: Reactivation did not restore login with established PIN: ${JSON.stringify(reactLoginData)}`);
    }
    console.log("PASSED: Reactivation restored mobile login using established PIN.\n");

    // =========================================================================
    // TEST 15: Audit Trail Verification
    // =========================================================================
    console.log("TEST 15: Verifying ActivityLog Records for Mobile Lifecycle Events...");
    const auditLogs = await prisma.activityLog.findMany({
      where: {
        OR: [
          { target: { contains: empA.id } },
          { actorId: empA.id },
        ],
      },
      orderBy: { timestamp: "asc" },
    });

    const actions = auditLogs.map((l) => l.action);
    console.log("Captured audit actions:", actions);

    const requiredActions = [
      "MOBILE_LOGIN_CREATED",
      "MOBILE_LOGIN_PIN_RESET",
      "MOBILE_LOGIN_PIN_CHANGED",
      "MOBILE_LOGIN_DEACTIVATED",
      "MOBILE_LOGIN_REACTIVATED",
    ];

    for (const reqAction of requiredActions) {
      if (!actions.includes(reqAction)) {
        throw new Error(`Test 15 FAILED: Missing audit log for action: "${reqAction}"`);
      }
    }

    // Verify no plaintext PINs leaked in target or metadata
    for (const log of auditLogs) {
      if (log.metadata && (log.metadata.includes(firstTempPin) || log.metadata.includes(newTempPin) || log.metadata.includes("789123"))) {
        throw new Error(`Test 15 FAILED: Plaintext PIN leaked into ActivityLog metadata! Log: ${JSON.stringify(log)}`);
      }
      if (log.action.includes(firstTempPin) || log.action.includes("789123")) {
        throw new Error(`Test 15 FAILED: Plaintext PIN leaked into ActivityLog action string! Log: ${JSON.stringify(log)}`);
      }
    }
    console.log("PASSED: All 5 lifecycle events verified in ActivityLog with zero PIN leakage.\n");

    console.log("=== ALL 15 MOBILE LOGIN LIFECYCLE & SECURITY TESTS PASSED ===");
  } finally {
    // Cleanup
    console.log("Cleaning up test records...");
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
    console.log("Cleanup complete.");
  }
}

main()
  .catch((err) => {
    console.error("TEST FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
