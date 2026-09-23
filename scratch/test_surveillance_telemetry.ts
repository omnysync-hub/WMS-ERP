import { prisma } from "../src/lib/prisma";
import { signMobileToken } from "../src/lib/auth/mobileAuth";

async function main() {
  console.log("=== RUNNING LOCATION SURVEILLANCE & TELEMETRY REGRESSION TESTS ===\n");

  const timestamp = Date.now();

  // Create Test Technician
  const tech = await prisma.employee.create({
    data: {
      name: `Surveillance Tech ${timestamp}`,
      email: `surv_tech_${timestamp}@workmanservices.pk`,
      phone: `+92314${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: "technician",
      department: "Field Operations",
      active: true,
      mobileLoginActive: true,
    },
  });

  // Create Test Customer & Active Job
  const customer = await prisma.customer.create({
    data: {
      name: `Surveillance Customer ${timestamp}`,
      phone: "+923001112233",
      addressText: "DHA Phase 5, Lahore",
      lat: 25.215,
      lng: 55.285,
    },
  });

  const activeJob = await prisma.job.create({
    data: {
      jobNumber: `JOB-SURV-${timestamp}`,
      customerId: customer.id,
      jobType: "repair",
      status: "InProgress",
      assignedTechnicianId: tech.id,
    },
  });

  // Create Admin
  const adminEmp = await prisma.employee.create({
    data: {
      name: `Surveillance Admin ${timestamp}`,
      email: `surv_admin_${timestamp}@workmanservices.pk`,
      phone: `+92315${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: "admin",
      department: "Management",
      active: true,
      mobileLoginActive: true,
    },
  });

  console.log(`Created Tech:     ${tech.name} (${tech.id})`);
  console.log(`Created Job:      ${activeJob.jobNumber} (${activeJob.id})`);
  console.log(`Created Admin:    ${adminEmp.name} (${adminEmp.id})\n`);

  // Import Route Handlers
  const { POST: telemetryPost } = await import(
    "../src/app/api/mobile/telemetry/route"
  );
  const { GET: consentGet, POST: consentPost } = await import(
    "../src/app/api/mobile/consent/route"
  );
  const { GET: historyGet } = await import(
    "../src/app/api/telemetry/history/route"
  );
  const { GET: exportGet } = await import(
    "../src/app/api/telemetry/export/route"
  );
  const { POST: cleanupPost } = await import(
    "../src/app/api/telemetry/cleanup/route"
  );

  function mockRequest(
    body: any = {},
    method = "POST",
    headers: Record<string, string> = {},
    url = "http://localhost:3000/api/test"
  ) {
    return {
      url,
      method,
      json: async () => body,
      headers: {
        get: (key: string) => headers[key.toLowerCase()] || null,
      },
    } as any;
  }

  function techAuthHeaders() {
    return {
      authorization: `Bearer ${signMobileToken(tech.id)}`,
    };
  }

  function adminHeaders() {
    return {
      "x-employee-id": adminEmp.id,
      "x-actor-role": "admin",
      "x-actor-name": adminEmp.name,
    };
  }

  try {
    // =========================================================================
    // TEST 1: Consent & Disclosure Lifecycle (GET & POST)
    // =========================================================================
    console.log("TEST 1: Testing Consent & Disclosure Lifecycle...");
    // 1a. Query consent before acknowledgment -> hasConsent: false
    const preConsentRes = await consentGet(
      mockRequest({}, "GET", techAuthHeaders(), `http://localhost:3000/api/mobile/consent?employeeId=${tech.id}`)
    );
    const preConsentData = await preConsentRes.json();
    if (preConsentRes.status !== 200 || preConsentData.hasConsent !== false) {
      throw new Error(`Test 1a FAILED: Expected hasConsent: false, got ${JSON.stringify(preConsentData)}`);
    }

    // 1b. Acknowledge consent
    const submitConsentRes = await consentPost(
      mockRequest(
        { employeeId: tech.id, deviceModel: "Samsung Galaxy S24" },
        "POST",
        techAuthHeaders()
      )
    );
    const submitConsentData = await submitConsentRes.json();
    if (submitConsentRes.status !== 200 || !submitConsentData.success) {
      throw new Error(`Test 1b FAILED: Consent submission failed: ${JSON.stringify(submitConsentData)}`);
    }

    // 1c. Re-query consent -> hasConsent: true
    const postConsentRes = await consentGet(
      mockRequest({}, "GET", techAuthHeaders(), `http://localhost:3000/api/mobile/consent?employeeId=${tech.id}`)
    );
    const postConsentData = await postConsentRes.json();
    if (postConsentRes.status !== 200 || postConsentData.hasConsent !== true) {
      throw new Error(`Test 1c FAILED: Expected hasConsent: true, got ${JSON.stringify(postConsentData)}`);
    }
    console.log("PASSED: Consent disclosure lifecycle verified.\n");

    // =========================================================================
    // TEST 2: Append-Only Telemetry Ingestion & Shift/Job Context Scoping
    // =========================================================================
    console.log("TEST 2: Testing Append-Only Telemetry Ingestion with Shift/Job Scoping...");
    const ping1Res = await telemetryPost(
      mockRequest(
        {
          employeeId: tech.id,
          lat: 25.2048,
          lng: 55.2708,
          accuracy: 5.2,
          speed: 35.5,
          batteryLevel: 98,
          isMoving: true,
          source: "mobile_gps",
        },
        "POST",
        techAuthHeaders()
      )
    );
    const ping1Data = await ping1Res.json();

    if (ping1Res.status !== 200 || !ping1Data.pingId || ping1Data.isShiftActive !== true) {
      throw new Error(`Test 2 FAILED: Ping 1 ingestion failed: ${JSON.stringify(ping1Data)}`);
    }
    if (ping1Data.activeJobId !== activeJob.id) {
      throw new Error(`Test 2 FAILED: Expected activeJobId to match active job, got ${ping1Data.activeJobId}`);
    }

    // Ingest Ping 2 (Moving along route)
    const ping2Res = await telemetryPost(
      mockRequest(
        {
          employeeId: tech.id,
          lat: 25.2100,
          lng: 55.2750,
          accuracy: 4.8,
          speed: 42.0,
          batteryLevel: 96,
          isMoving: true,
          source: "mobile_gps",
        },
        "POST",
        techAuthHeaders()
      )
    );
    if (ping2Res.status !== 200) {
      throw new Error(`Test 2 FAILED: Ping 2 failed: ${ping2Res.status}`);
    }

    // Verify records in DB
    const pingsInDb = await prisma.technicianLocationPing.findMany({
      where: { employeeId: tech.id },
      orderBy: { timestamp: "asc" },
    });
    if (pingsInDb.length !== 2) {
      throw new Error(`Test 2 FAILED: Expected 2 pings in DB, found ${pingsInDb.length}`);
    }
    if (pingsInDb[0].speed !== 35.5 || pingsInDb[1].batteryLevel !== 96) {
      throw new Error("Test 2 FAILED: Ingested telemetry values do not match stored values.");
    }
    console.log("PASSED: Append-only telemetry history verified with active job tag.\n");

    // =========================================================================
    // TEST 3: Offline Gap Detection (> 10 Minutes Silence)
    // =========================================================================
    console.log("TEST 3: Testing Offline Gap Detection...");
    // Simulate time jump: set employee.lastPingAt to 25 minutes ago
    const twentyFiveMinutesAgo = new Date(Date.now() - 25 * 60 * 1000);
    await prisma.employee.update({
      where: { id: tech.id },
      data: {
        lastPingAt: twentyFiveMinutesAgo,
        lat: 25.2100,
        lng: 55.2750,
      },
    });

    // Ingest Ping 3 (Reconnecting after gap)
    const ping3Res = await telemetryPost(
      mockRequest(
        {
          employeeId: tech.id,
          lat: 25.2250,
          lng: 55.2900,
          accuracy: 6.0,
          speed: 15.0,
          batteryLevel: 88,
          isMoving: true,
          source: "mobile_gps",
        },
        "POST",
        techAuthHeaders()
      )
    );
    if (ping3Res.status !== 200) {
      throw new Error(`Test 3 FAILED: Ping 3 failed: ${ping3Res.status}`);
    }

    // Verify OfflineGapLog was created
    const gapInDb = await prisma.offlineGapLog.findFirst({
      where: { employeeId: tech.id },
      orderBy: { createdAt: "desc" },
    });
    if (!gapInDb) {
      throw new Error("Test 3 FAILED: Expected OfflineGapLog record was not created!");
    }
    if ((gapInDb.durationMinutes || 0) < 24) {
      throw new Error(`Test 3 FAILED: Expected durationMinutes ~25, got ${gapInDb.durationMinutes}`);
    }
    if (gapInDb.lastKnownLat !== 25.2100 || gapInDb.resumeLat !== 25.2250) {
      throw new Error("Test 3 FAILED: Coordinates on gap log do not match last known vs resume.");
    }
    console.log(`PASSED: Offline gap detected and logged (${gapInDb.durationMinutes}m offline).\n`);

    // =========================================================================
    // TEST 4: Historical Surveillance Query API & Authorization Guards
    // =========================================================================
    console.log("TEST 4: Testing Historical Surveillance Query API & Authorization Guards...");
    const historyUrl = `http://localhost:3000/api/telemetry/history?employeeId=${tech.id}&startDate=${new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()}&endDate=${new Date().toISOString()}`;

    // 4a. Anonymous -> 401
    const anonRes = await historyGet(mockRequest({}, "GET", {}, historyUrl));
    if (anonRes.status !== 401) {
      throw new Error(`Test 4a FAILED: Expected 401 for anonymous query, got ${anonRes.status}`);
    }

    // 4b. Technician (non-admin) querying -> 403
    const techQueryRes = await historyGet(mockRequest({}, "GET", techAuthHeaders(), historyUrl));
    if (techQueryRes.status !== 403) {
      throw new Error(`Test 4b FAILED: Expected 403 for technician query, got ${techQueryRes.status}`);
    }

    // 4c. Admin querying -> 200 with full trajectory and summary
    const adminQueryRes = await historyGet(mockRequest({}, "GET", adminHeaders(), historyUrl));
    const adminQueryData = await adminQueryRes.json();

    if (adminQueryRes.status !== 200 || !adminQueryData.summary) {
      throw new Error(`Test 4c FAILED: Admin query failed: ${JSON.stringify(adminQueryData)}`);
    }
    if (adminQueryData.pings.length !== 3) {
      throw new Error(`Test 4c FAILED: Expected 3 pings, got ${adminQueryData.pings.length}`);
    }
    if (adminQueryData.summary.offlineIncidents !== 1) {
      throw new Error(`Test 4c FAILED: Expected 1 offline incident, got ${adminQueryData.summary.offlineIncidents}`);
    }
    if (adminQueryData.summary.totalDistanceKm <= 0) {
      throw new Error("Test 4c FAILED: Expected positive totalDistanceKm calculation.");
    }
    console.log(`PASSED: Historical telemetry query verified: ${adminQueryData.summary.totalDistanceKm}km traveled, ${adminQueryData.summary.offlineIncidents} gap incident.\n`);

    // =========================================================================
    // TEST 5: Telemetry Export API (CSV & JSON)
    // =========================================================================
    console.log("TEST 5: Testing Telemetry Export API (CSV & JSON)...");
    const exportCsvUrl = `http://localhost:3000/api/telemetry/export?employeeId=${tech.id}&format=csv`;
    const exportCsvRes = await exportGet(mockRequest({}, "GET", adminHeaders(), exportCsvUrl));
    const csvText = await exportCsvRes.text();

    if (exportCsvRes.status !== 200 || !csvText.includes("timestamp_utc") || !csvText.includes(tech.name)) {
      throw new Error(`Test 5 FAILED: Invalid CSV export output: ${csvText.slice(0, 200)}`);
    }

    const exportJsonUrl = `http://localhost:3000/api/telemetry/export?employeeId=${tech.id}&format=json`;
    const exportJsonRes = await exportGet(mockRequest({}, "GET", adminHeaders(), exportJsonUrl));
    const exportJsonData = await exportJsonRes.json();

    if (exportJsonRes.status !== 200 || exportJsonData.totalPings !== 3) {
      throw new Error(`Test 5 FAILED: Invalid JSON export output: ${JSON.stringify(exportJsonData)}`);
    }
    console.log("PASSED: Telemetry export (CSV & JSON) verified.\n");

    // =========================================================================
    // TEST 6: Retention Policy Execution & Cleanup Guard
    // =========================================================================
    console.log("TEST 6: Testing Retention Policy Execution...");
    // 6a. Guard: retentionDays < 7 -> 400
    const invalidRetentionRes = await cleanupPost(
      mockRequest({ retentionDays: 3 }, "POST", adminHeaders())
    );
    if (invalidRetentionRes.status !== 400) {
      throw new Error(`Test 6a FAILED: Expected 400 for retention < 7 days, got ${invalidRetentionRes.status}`);
    }

    // 6b. Dry Run -> returns preview without purging recent records
    const dryRunRes = await cleanupPost(
      mockRequest({ retentionDays: 90, dryRun: true }, "POST", adminHeaders())
    );
    const dryRunData = await dryRunRes.json();
    if (dryRunRes.status !== 200 || !dryRunData.dryRun) {
      throw new Error(`Test 6b FAILED: Dry run failed: ${JSON.stringify(dryRunData)}`);
    }

    // 6c. Purge simulation with old records:
    // Create one artificial ping 120 days ago
    const oneHundredTwentyDaysAgo = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    await prisma.technicianLocationPing.create({
      data: {
        employeeId: tech.id,
        lat: 25.0,
        lng: 55.0,
        isMoving: false,
        timestamp: oneHundredTwentyDaysAgo,
      },
    });

    const purgeRes = await cleanupPost(
      mockRequest({ retentionDays: 90, dryRun: false }, "POST", adminHeaders())
    );
    const purgeData = await purgeRes.json();
    if (purgeRes.status !== 200 || purgeData.purgedPingsCount < 1) {
      throw new Error(`Test 6c FAILED: Expected at least 1 purged ping, got: ${JSON.stringify(purgeData)}`);
    }

    // Verify recent 3 pings are strictly preserved
    const remainingPings = await prisma.technicianLocationPing.count({
      where: { employeeId: tech.id },
    });
    if (remainingPings !== 3) {
      throw new Error(`Test 6c FAILED: Expected 3 recent pings preserved, found ${remainingPings}`);
    }
    console.log(`PASSED: Retention policy safely purged old ping and preserved ${remainingPings} active pings.\n`);

    console.log("=== ALL 6 SURVEILLANCE & TELEMETRY REGRESSION TESTS PASSED SUCCESSFULLY ===");
  } finally {
    // Cleanup test records
    console.log("Cleaning up test records...");
    await prisma.offlineGapLog.deleteMany({
      where: { employeeId: tech.id },
    });
    await prisma.technicianLocationPing.deleteMany({
      where: { employeeId: tech.id },
    });
    await prisma.technicianConsentRecord.deleteMany({
      where: { employeeId: tech.id },
    });
    await prisma.job.deleteMany({
      where: { id: activeJob.id },
    });
    await prisma.customer.deleteMany({
      where: { id: customer.id },
    });
    await prisma.activityLog.deleteMany({
      where: {
        OR: [
          { actorId: adminEmp.id },
          { target: { contains: "Cutoff" } },
        ],
      },
    });
    await prisma.employee.deleteMany({
      where: { id: { in: [tech.id, adminEmp.id] } },
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
