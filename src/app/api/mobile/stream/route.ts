export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { MobilePushService } from "@/lib/services/MobilePushService";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");

  if (!employeeId) {
    return new Response(JSON.stringify({ error: "employeeId parameter is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial handshake
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", employeeId, time: new Date().toISOString() })}\n\n`)
      );

      // Subscribe to real-time events for this technician
      cleanup = MobilePushService.subscribeSse(employeeId, (event) => {
        try {
          const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (e) {
          // Stream closed
        }
      });

      // Keep connection alive with lightweight heartbeat ping every 25 seconds
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch (e) {
          clearInterval(heartbeatInterval);
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        if (cleanup) cleanup();
        try {
          controller.close();
        } catch (e) {
          // already closed
        }
      });
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
