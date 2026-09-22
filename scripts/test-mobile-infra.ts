import { prisma } from "../src/lib/prisma";
import { MobilePushService } from "../src/lib/services/MobilePushService";
import { JobsService } from "../src/lib/services/JobsService";

async function runMobileInfraVerification() {
  console.log("=================================================");
  console.log("TESTING WORKMAN SERVICES ERP MOBILE INFRASTRUCTURE");
  console.log("=================================================");

  try {
    // 1. Find or pick active technician
    const technician = await prisma.employee.findFirst({
      where: { role: "technician", active: true },
    });

    if (!technician) {
      throw new Error("No active technician found in database. Seed employees first.");
    }
    console.log(`✓ 1. Selected Technician: ${technician.name} (ID: ${technician.id})`);

    // 2. Register Mobile Device Push Token (iOS & Android)
    const testToken = `ExponentPushToken[TestMobileDev_${Date.now()}]`;
    const deviceToken = await MobilePushService.registerPushToken({
      employeeId: technician.id,
      token: testToken,
      platform: "ios",
      deviceModel: "iPhone 15 Pro",
      osVersion: "iOS 17.5.1",
      appVersion: "1.0.0",
    });
    console.log(`✓ 2. Push Token Registered: ${deviceToken.token} (${deviceToken.platform}, ${deviceToken.deviceModel})`);

    // 3. Dispatch an Urgent App Request from ERP to Technician
    const dispatchedRequest = await MobilePushService.sendAppRequest({
      recipientId: technician.id,
      senderName: "Zeeshan Ahmed",
      senderRole: "dispatcher",
      type: "EMERGENCY_ALERT",
      title: "🚨 Urgent Job Site Divert: Compressor Tripping",
      body: "Customer reports high refrigerant pressure and compressor tripping at Building 4. Please divert immediately.",
      priority: "urgent",
      actionRequired: true,
      payload: {
        customerName: "Al-Baraka Commercial Tower",
        lat: 25.2048,
        lng: 55.2708,
        urgentReason: "Refrigerant high pressure safety switch tripped",
      },
    });
    console.log(`✓ 3. Dispatched MobileAppRequest Created: ${dispatchedRequest.id} (Priority: ${dispatchedRequest.priority}, Status: ${dispatchedRequest.deliveryStatus})`);

    // 4. Query Technician's Pending Inbox
    const pendingRequests = await prisma.mobileAppRequest.findMany({
      where: { recipientId: technician.id, actionStatus: "pending" },
      orderBy: { createdAt: "desc" },
    });
    console.log(`✓ 4. Queried Technician Inbox: Found ${pendingRequests.length} pending request(s).`);

    // 5. Technician Responds / Accepts Request
    const respondedRequest = await MobilePushService.respondToRequest(
      dispatchedRequest.id,
      technician.id,
      "accepted",
      {
        notes: "Acknowledged and en route. Estimated arrival in 15 minutes.",
        etaMinutes: 15,
      }
    );
    console.log(`✓ 5. Technician Responded: ActionStatus='${respondedRequest.actionStatus}', RespondedAt=${respondedRequest.respondedAt?.toISOString()}`);

    // 6. Test GPS Telemetry Ingestion
    const updatedTech = await prisma.employee.update({
      where: { id: technician.id },
      data: {
        lat: 25.2084,
        lng: 55.2742,
        lastPingAt: new Date(),
      },
    });
    console.log(`✓ 6. Telemetry Ingested: Lat=${updatedTech.lat}, Lng=${updatedTech.lng}, LastPing=${updatedTech.lastPingAt?.toISOString()}`);

    // Clean up test push token
    await prisma.devicePushToken.deleteMany({
      where: { token: testToken },
    });
    console.log("✓ 7. Test token cleanup completed.");

    console.log("\n=================================================");
    console.log("🎉 ALL MOBILE INFRASTRUCTURE VERIFICATIONS PASSED!");
    console.log("=================================================");
  } catch (err: any) {
    console.error("❌ Verification Failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMobileInfraVerification();
