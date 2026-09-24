import { prisma } from "@/lib/prisma";

export interface RegisterPushTokenParams {
  employeeId: string;
  token: string;
  platform: "ios" | "android" | "web";
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
}

export interface SendAppRequestParams {
  recipientId: string;
  senderId?: string;
  senderName?: string;
  senderRole?: string;
  type:
    | "JOB_DISPATCH"
    | "JOB_RESCHEDULED"
    | "JOB_CANCELLED"
    | "DISCOUNT_DECISION"
    | "INVENTORY_ISSUED"
    | "EMERGENCY_ALERT"
    | "HISAAB_CLEARED"
    | "PING_REQUEST"
    | "GENERAL_MESSAGE";
  title: string;
  body: string;
  priority?: "urgent" | "high" | "normal" | "low";
  payload?: Record<string, any>;
  actionRequired?: boolean;
}

// In-memory pub/sub listener map for real-time Server-Sent Events (SSE)
type SseListener = (event: { type: string; data: any }) => void;
const sseSubscribers = new Map<string, Set<SseListener>>();

export class MobilePushService {
  /**
   * Register or update a mobile device push token (iOS APNs / Android FCM via Expo)
   */
  static async registerPushToken(params: RegisterPushTokenParams) {
    const { employeeId, token, platform, deviceModel, osVersion, appVersion } = params;

    // Verify employee exists
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new Error(`Technician/Employee not found with ID ${employeeId}`);
    }

    const deviceToken = await prisma.devicePushToken.upsert({
      where: { token },
      update: {
        employeeId,
        platform,
        deviceModel: deviceModel || undefined,
        osVersion: osVersion || undefined,
        appVersion: appVersion || undefined,
        isActive: true,
        lastActiveAt: new Date(),
      },
      create: {
        employeeId,
        token,
        platform,
        deviceModel,
        osVersion,
        appVersion,
        isActive: true,
        lastActiveAt: new Date(),
      },
    });

    return deviceToken;
  }

  /**
   * Deactivate a push token upon app logout
   */
  static async unregisterPushToken(token: string) {
    try {
      await prisma.devicePushToken.update({
        where: { token },
        data: { isActive: false },
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as any).message };
    }
  }

  /**
   * Send a task request / push notification from ERP to technician's mobile app
   */
  static async sendAppRequest(params: SendAppRequestParams) {
    const {
      recipientId,
      senderId,
      senderName = "Dispatcher",
      senderRole = "dispatcher",
      type,
      title,
      body,
      priority = "normal",
      payload = {},
      actionRequired = false,
    } = params;

    // 1. Create persistent request in database
    const request = await prisma.mobileAppRequest.create({
      data: {
        recipientId,
        senderId: senderId || null,
        senderName,
        senderRole,
        type,
        title,
        body,
        priority,
        payloadJson: JSON.stringify(payload),
        actionRequired,
        actionStatus: actionRequired ? "pending" : "acknowledged",
        deliveryStatus: "queued",
      },
      include: {
        recipient: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    // 2. Query active device tokens for the recipient
    const activeTokens = await prisma.devicePushToken.findMany({
      where: {
        employeeId: recipientId,
        isActive: true,
      },
    });

    // 3. Dispatch native push notifications via Expo Push API (works for iOS and Android)
    if (activeTokens.length > 0) {
      const pushMessages = activeTokens.map((t: any) => ({
        to: t.token,
        sound: "default",
        title,
        body,
        data: {
          requestId: request.id,
          type,
          priority,
          actionRequired,
          ...payload,
        },
        priority: priority === "urgent" || priority === "high" ? "high" : "default",
        channelId:
          priority === "urgent" || priority === "high"
            ? "urgent-dispatch"
            : "general-dispatch",
        _contentAvailable: true,
      }));

      // Non-blocking async push dispatch
      this.deliverExpoPush(pushMessages)
        .then(async (delivered) => {
          if (delivered) {
            await prisma.mobileAppRequest.update({
              where: { id: request.id },
              data: {
                deliveryStatus: "sent",
                sentAt: new Date(),
              },
            });
          }
        })
        .catch((err) => {
          console.warn("[MobilePushService] Push delivery notice:", err.message);
        });
    }

    // 4. Emit instant real-time event to SSE subscribers (zero latency in-app update)
    this.broadcastToSse(recipientId, {
      type: "NEW_APP_REQUEST",
      data: {
        id: request.id,
        title,
        body,
        type,
        priority,
        actionRequired,
        payload,
        createdAt: request.createdAt,
      },
    });

    return request;
  }

  /**
   * Broadcast an urgent announcement or request to multiple technicians
   */
  static async broadcastToTechnicians(
    recipientIds: string[],
    params: Omit<SendAppRequestParams, "recipientId">
  ) {
    const results = await Promise.all(
      recipientIds.map((recipientId) =>
        this.sendAppRequest({
          ...params,
          recipientId,
        })
      )
    );
    return results;
  }

  /**
   * Technician marks a request as read
   */
  static async markAsRead(requestId: string, employeeId: string) {
    return await prisma.mobileAppRequest.updateMany({
      where: { id: requestId, recipientId: employeeId },
      data: {
        deliveryStatus: "read",
        readAt: new Date(),
      },
    });
  }

  /**
   * Technician responds to an action-required request (e.g. Accept/Decline Job)
   */
  static async respondToRequest(
    requestId: string,
    employeeId: string,
    actionStatus: "accepted" | "rejected" | "acknowledged",
    responseDetails?: {
      notes?: string;
      reason?: string;
      etaMinutes?: number;
    }
  ) {
    const request = await prisma.mobileAppRequest.findFirst({
      where: { id: requestId, recipientId: employeeId },
    });

    if (!request) {
      throw new Error("Mobile request not found or not assigned to this technician");
    }

    const updated = await prisma.mobileAppRequest.update({
      where: { id: requestId },
      data: {
        actionStatus,
        actionResponseJson: responseDetails ? JSON.stringify(responseDetails) : null,
        respondedAt: new Date(),
        deliveryStatus: "read",
        readAt: request.readAt || new Date(),
      },
    });

    // Notify any dispatchers listening
    this.broadcastToSse("dispatchers", {
      type: "REQUEST_RESPONDED",
      data: {
        requestId,
        employeeId,
        actionStatus,
        responseDetails,
      },
    });

    return updated;
  }

  /**
   * Deliver push messages to Expo Push API endpoint
   */
  private static async deliverExpoPush(messages: any[]): Promise<boolean> {
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        console.warn(
          `[MobilePushService] Expo Push API responded with status ${response.status}`
        );
        return false;
      }

      const result = await response.json();
      return Boolean(result && result.data);
    } catch (err: any) {
      // Graceful offline fallback in dev environments
      console.log(`[MobilePushService] Offline/Local simulated push dispatch: ${err.message}`);
      return false;
    }
  }

  /**
   * Real-time Server-Sent Events (SSE) subscriber registration
   */
  static subscribeSse(recipientId: string, listener: SseListener) {
    if (!sseSubscribers.has(recipientId)) {
      sseSubscribers.set(recipientId, new Set());
    }
    sseSubscribers.get(recipientId)!.add(listener);

    return () => {
      const set = sseSubscribers.get(recipientId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) sseSubscribers.delete(recipientId);
      }
    };
  }

  /**
   * Broadcast an event to connected SSE subscribers
   */
  static broadcastToSse(recipientId: string, event: { type: string; data: any }) {
    const listeners = sseSubscribers.get(recipientId);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (e) {
          // ignore dead listener
        }
      });
    }
  }
}
