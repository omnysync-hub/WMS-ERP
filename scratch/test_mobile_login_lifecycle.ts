import { prisma } from "../src/lib/prisma";
import { signMobileToken } from "../src/lib/auth/mobileAuth";

async function main() {
  console.log("=== RUNNING DIRECT MOBILE PASSWORD LIFECYCLE & SECURITY REGRESSION TESTS ===\n");

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
  const { POST: resetPasswordPost } = await import(
    "../src/app/api/employees/[id]/mobile-login/reset-password/route"
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

  const initialDirectPassword = "SecurePass#2026";
  const customUsername = `tech.alpha.${timestamp}`;

  try {
    // =========================================================================
    // TEST 1: Unauthorized Creation Attempt (Technician -> 403)
    // =========================================================================
    console.log("TEST 1: Testing Non-Admin Creation Guard (Employee A attempts to create login for B -> 403)...");
    const unauthCreateRes = await createLoginPost(
      mockRequest({ password: initialDirectPassword }, "POST", { "x-employee-id": empA.id, "x-actor-role": "technician" }),
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
    const anonRes = await createLoginPost(mockRequest({ password: initialDirectPassword }), { params: { id: empA.id } });
    if (anonRes.status !== 401) {
      throw new Error(`Test 2 FAILED: Expected 401 for anonymous creation, got ${anonRes.status}`);
    }
    console.log("PASSED: Anonymous creation strictly rejected with HTTP 401.\n");

    // =========================================================================
    // TEST 3: Validation: Short Password (< 6 chars -> 400)
    // =========================================================================
    console.log("TEST 3: Testing Password Strength Validation (Short password -> 400)...");
    const shortPassRes = await createLoginPost(
      mockRequest({ password: "12345" }, "POST", adminHeaders()),
      { params: { id: empA.id } }
    );
    if (shortPassRes.status !== 400) {
      throw new Error(`Test 3 FAILED: Expected 400 for password < 6 chars, got ${shortPassRes.status}`);
    }
    console.log("PASSED: Password < 6 chars rejected with HTTP 400.\n");

    // =========================================================================
    // TEST 4: Legitimate Mobile Login Creation with Direct Password & Username
    // =========================================================================
    console.log("TEST 4: Testing Direct Password Creation by HR Admin...");
    const createRes = await createLoginPost(
      mockRequest(
        { password: initialDirectPassword, username: customUsername },
        "POST",
        adminHeaders()
      ),
      { params: { id: empA.id } }
    );
    const createData = await createRes.json();

    if (createRes.status !== 200 || !createData.success) {
      throw new Error(`Test 4 FAILED: Expected 200, got status ${createRes.status}, data: ${JSON.stringify(createData)}`);
    }

    // Ensure password is not leaked in response
    if (JSON.stringify(createData).includes(initialDirectPassword)) {
      throw new Error("Test 4 FAILED: Plaintext password leaked in creation response!");
    }

    const empInDbAfterCreate = await prisma.employee.findUnique({
      where: { id: empA.id },
    });
    if (
      !empInDbAfterCreate?.mobileLoginActive ||
      !empInDbAfterCreate?.mobilePasswordHash ||
      empInDbAfterCreate.mobileUsername !== customUsername ||
      empInDbAfterCreate.failedLoginAttempts !== 0 ||
      !empInDbAfterCreate.mobilePasswordSetAt
    ) {
      throw new Error("Test 4 FAILED: Database fields not correctly set after mobile login creation.");
    }
    console.log(`PASSED: Admin successfully provisioned direct password and username (${customUsername}).\n`);

    // =========================================================================
    // TEST 5: Duplicate Username Guard (Employee B tries to take same username -> 409)
    // =========================================================================
    console.log("TEST 5: Testing Duplicate Username Conflict Guard -> 409...");
    const dupUserRes = await createLoginPost(
      mockRequest(
        { password: "AnotherValidPass#1", username: customUsername },
        "POST",
        adminHeaders()
      ),
      { params: { id: empB.id } }
    );
    if (dupUserRes.status !== 409) {
      throw new Error(`Test 5 FAILED: Expected 409 for duplicate username, got ${dupUserRes.status}`);
    }
    console.log("PASSED: Duplicate mobileUsername rejected with HTTP 409 Conflict.\n");

    // =========================================================================
    // TEST 6: Status Endpoint Security & Hash Masking
    // =========================================================================
    console.log("TEST 6: Testing Status Endpoint (Ensures password hash is NEVER returned)...");
    const statusRes = await statusGet(
      mockRequest({}, "GET", adminHeaders()),
      { params: { id: empA.id } }
    );
    const statusData = await statusRes.json();

    if (
      statusRes.status !== 200 ||
      statusData.mobileLoginActive !== true ||
      statusData.mobileUsername !== customUsername ||
      "mobilePasswordHash" in statusData ||
      "mobilePinHash" in statusData
    ) {
      throw new Error(`Test 6 FAILED: Status invalid or leaked hash! Data: ${JSON.stringify(statusData)}`);
    }
    console.log("PASSED: Status endpoint verified; password hash strictly excluded.\n");

    // =========================================================================
    // TEST 7: Immediate Direct Mobile Login (No Forced PIN Reset Flow)
    // =========================================================================
    console.log("TEST 7: Testing Immediate Direct Login using Username and Direct Password...");
    const userLoginRes = await authPost(
      mockRequest({ username: customUsername, password: initialDirectPassword })
    );
    const userLoginData = await userLoginRes.json();
    if (userLoginRes.status !== 200 || !userLoginData.success || !userLoginData.token) {
      throw new Error(`Test 7 FAILED: Username direct login failed: ${JSON.stringify(userLoginData)}`);
    }
    if (userLoginData.mustResetPinOnNextLogin) {
      throw new Error("Test 7 FAILED: Unexpected mustResetPinOnNextLogin returned on direct login!");
    }
    console.log("PASSED: Employee logged in immediately with direct credentials without forced reset.\n");

    // Test identifier flexibility: phone + password
    console.log("TEST 7b: Testing Login with Phone + Password...");
    const phoneLoginRes = await authPost(
      mockRequest({ phone: empA.phone, password: initialDirectPassword })
    );
    if (phoneLoginRes.status !== 200) {
      throw new Error(`Test 7b FAILED: Phone login failed: ${phoneLoginRes.status}`);
    }
    console.log("PASSED: Phone + password login succeeded.\n");

    // =========================================================================
    // TEST 8: Incorrect Password -> 401 & Counter Increment
    // =========================================================================
    console.log("TEST 8: Testing Incorrect Password Login -> 401 & failedLoginAttempts increment...");
    const wrongPassRes = await authPost(
      mockRequest({ username: customUsername, password: "WrongPassword999" })
    );
    const wrongPassData = await wrongPassRes.json();
    if (wrongPassRes.status !== 401 || wrongPassData.remainingAttempts !== 4) {
      throw new Error(`Test 8 FAILED: Expected 401 with remainingAttempts=4, got status ${wrongPassRes.status}`);
    }

    const empAfterFailedAttempt = await prisma.employee.findUnique({
      where: { id: empA.id },
      select: { failedLoginAttempts: true },
    });
    if (empAfterFailedAttempt?.failedLoginAttempts !== 1) {
      throw new Error(`Test 8 FAILED: Expected failedLoginAttempts=1, got ${empAfterFailedAttempt?.failedLoginAttempts}`);
    }
    console.log("PASSED: Wrong password rejected; attempt counter correctly incremented.\n");

    // =========================================================================
    // TEST 9: Brute-Force Lockout Enforcement & Anti-Timing Bypass Test
    // =========================================================================
    console.log("TEST 9: Testing Brute-Force Lockout Enforcement (Simulating 4 more failures)...");
    for (let i = 2; i <= 4; i++) {
      await authPost(mockRequest({ username: customUsername, password: "WrongPassword999" }));
    }

    // 5th attempt: triggers lockout
    const lockTriggerRes = await authPost(
      mockRequest({ username: customUsername, password: "WrongPassword999" })
    );
    const lockTriggerData = await lockTriggerRes.json();
    if (lockTriggerRes.status !== 401 || !lockTriggerData.isLocked) {
      throw new Error(`Test 9 FAILED: Expected 5th failure to trigger isLocked, got ${JSON.stringify(lockTriggerData)}`);
    }

    // Subsequent attempt with WRONG password while locked -> 423
    const whileLockedWrongRes = await authPost(
      mockRequest({ username: customUsername, password: "WrongPassword999" })
    );
    if (whileLockedWrongRes.status !== 423) {
      throw new Error(`Test 9 FAILED: Expected 423 Locked on wrong pass while locked, got ${whileLockedWrongRes.status}`);
    }

    // CRITICAL: Subsequent attempt with CORRECT password while locked MUST ALSO RETURN 423!
    console.log("TEST 9b: Testing Locked Account Rejection with CORRECT Password (Anti-timing guard)...");
    const whileLockedCorrectRes = await authPost(
      mockRequest({ username: customUsername, password: initialDirectPassword })
    );
    if (whileLockedCorrectRes.status !== 423) {
      throw new Error(`Test 9b FAILED: Expected 423 Locked even with correct password while locked, got ${whileLockedCorrectRes.status}`);
    }

    // Verify counter was NOT reset by the correct password attempt
    const empStillLocked = await prisma.employee.findUnique({
      where: { id: empA.id },
      select: { failedLoginAttempts: true, lockedUntil: true },
    });
    if (empStillLocked?.failedLoginAttempts !== 5 || !empStillLocked?.lockedUntil) {
      throw new Error("Test 9b FAILED: Lockout state was compromised by correct password attempt during lockout!");
    }
    console.log("PASSED: Account locked out; both wrong and correct passwords strictly rejected with HTTP 423.\n");

    // =========================================================================
    // TEST 10: Admin Direct Password Reset Clears Lockout
    // =========================================================================
    console.log("TEST 10: Testing Admin Direct Password Reset (Clears lockout & sets new password)...");
    const newAdminSetPassword = "NewAdminPassword#789";
    const resetRes = await resetPasswordPost(
      mockRequest({ password: newAdminSetPassword }, "POST", adminHeaders()),
      { params: { id: empA.id } }
    );
    const resetData = await resetRes.json();
    if (resetRes.status !== 200 || !resetData.success) {
      throw new Error(`Test 10 FAILED: Reset failed with status ${resetRes.status}, data: ${JSON.stringify(resetData)}`);
    }

    const empAfterReset = await prisma.employee.findUnique({
      where: { id: empA.id },
    });
    if (empAfterReset?.lockedUntil !== null || empAfterReset?.failedLoginAttempts !== 0) {
      throw new Error("Test 10 FAILED: Reset password did not clear lockout or failedLoginAttempts.");
    }
    console.log("PASSED: Admin direct password reset cleared lockout successfully.\n");

    // =========================================================================
    // TEST 11: Login Verification with Newly Reset Password
    // =========================================================================
    console.log("TEST 11: Testing Login with New Reset Password vs Old Password...");
    // Old password must fail
    const oldLoginRes = await authPost(
      mockRequest({ username: customUsername, password: initialDirectPassword })
    );
    if (oldLoginRes.status !== 401) {
      throw new Error(`Test 11 FAILED: Expected old password to fail, got ${oldLoginRes.status}`);
    }

    // New password must succeed immediately
    const newLoginRes = await authPost(
      mockRequest({ username: customUsername, password: newAdminSetPassword })
    );
    const newLoginData = await newLoginRes.json();
    if (newLoginRes.status !== 200 || !newLoginData.token) {
      throw new Error(`Test 11 FAILED: New password login failed: ${JSON.stringify(newLoginData)}`);
    }
    const sessionToken = newLoginData.token;
    console.log("PASSED: Old password rejected; new reset password works immediately.\n");

    // =========================================================================
    // TEST 12: Self-Service Mobile Password Change
    // =========================================================================
    console.log("TEST 12: Testing Self-Service Mobile Password Change (/api/mobile/auth/change-pin)...");
    // 1. Wrong current password -> 401
    const wrongCurrentRes = await changePinPost(
      mockRequest(
        { currentPin: "WrongCurrentPass", newPin: "FreshEmpPassword#1" },
        "POST",
        { authorization: `Bearer ${sessionToken}` }
      )
    );
    if (wrongCurrentRes.status !== 401) {
      throw new Error(`Test 12 FAILED: Expected 401 for wrong current password, got ${wrongCurrentRes.status}`);
    }

    // 2. Short new password -> 400
    const shortNewRes = await changePinPost(
      mockRequest(
        { currentPin: newAdminSetPassword, newPin: "123" },
        "POST",
        { authorization: `Bearer ${sessionToken}` }
      )
    );
    if (shortNewRes.status !== 400) {
      throw new Error(`Test 12 FAILED: Expected 400 for short new password, got ${shortNewRes.status}`);
    }

    // 3. Legitimate self-service change
    const legitimateSelfPass = "TechAlphaCustom#999";
    const validChangeRes = await changePinPost(
      mockRequest(
        { currentPin: newAdminSetPassword, newPin: legitimateSelfPass },
        "POST",
        { authorization: `Bearer ${sessionToken}` }
      )
    );
    const validChangeData = await validChangeRes.json();
    if (validChangeRes.status !== 200 || !validChangeData.success) {
      throw new Error(`Test 12 FAILED: Password change failed: ${JSON.stringify(validChangeData)}`);
    }

    // Verify login with user-updated password
    const selfLoginRes = await authPost(
      mockRequest({ username: customUsername, password: legitimateSelfPass })
    );
    const selfLoginData = await selfLoginRes.json();
    if (selfLoginRes.status !== 200 || !selfLoginData.token) {
      throw new Error("Test 12 FAILED: Login failed with self-service changed password.");
    }
    const activeToken = selfLoginData.token;
    console.log("PASSED: Self-service password change succeeded and logs in immediately.\n");

    // =========================================================================
    // TEST 13: Deactivation & Immediate Token Invalidation
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
    const deactLoginRes = await authPost(mockRequest({ username: customUsername, password: legitimateSelfPass }));
    if (deactLoginRes.status !== 403) {
      throw new Error(`Test 13 FAILED: Expected 403 for deactivated employee login, got ${deactLoginRes.status}`);
    }
    console.log("PASSED: Deactivation immediately invalidated existing token and blocked new logins (HTTP 403).\n");

    // =========================================================================
    // TEST 14: Reactivation Restores Access with Established Password
    // =========================================================================
    console.log("TEST 14: Testing Reactivation (Restores access with existing password)...");
    const reactRes = await reactivatePost(
      mockRequest({}, "POST", adminHeaders()),
      { params: { id: empA.id } }
    );
    if (reactRes.status !== 200) {
      throw new Error(`Test 14 FAILED: Reactivation failed with status ${reactRes.status}`);
    }

    // Login with existing password succeeds
    const reactLoginRes = await authPost(mockRequest({ username: customUsername, password: legitimateSelfPass }));
    const reactLoginData = await reactLoginRes.json();
    if (reactLoginRes.status !== 200 || !reactLoginData.success) {
      throw new Error(`Test 14 FAILED: Reactivation did not restore login with established password: ${JSON.stringify(reactLoginData)}`);
    }
    console.log("PASSED: Reactivation restored mobile login using established password.\n");

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
      "MOBILE_LOGIN_PASSWORD_RESET",
      "MOBILE_LOGIN_PASSWORD_CHANGED",
      "MOBILE_LOGIN_DEACTIVATED",
      "MOBILE_LOGIN_REACTIVATED",
    ];

    for (const reqAction of requiredActions) {
      if (!actions.includes(reqAction)) {
        throw new Error(`Test 15 FAILED: Missing audit log for action: "${reqAction}"`);
      }
    }

    // Verify no plaintext passwords leaked in target or metadata
    const sensitiveStrings = [initialDirectPassword, newAdminSetPassword, legitimateSelfPass];
    for (const log of auditLogs) {
      for (const secret of sensitiveStrings) {
        if (log.metadata && log.metadata.includes(secret)) {
          throw new Error(`Test 15 FAILED: Plaintext password leaked into ActivityLog metadata! Log: ${JSON.stringify(log)}`);
        }
        if (log.action.includes(secret)) {
          throw new Error(`Test 15 FAILED: Plaintext password leaked into ActivityLog action string! Log: ${JSON.stringify(log)}`);
        }
      }
    }
    console.log("PASSED: All 5 lifecycle events verified in ActivityLog with zero password leakage.\n");

    console.log("=== ALL 15 DIRECT PASSWORD LIFECYCLE & SECURITY TESTS PASSED ===");
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
