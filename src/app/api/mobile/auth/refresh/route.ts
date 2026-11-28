export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signMobileToken, verifyMobileToken } from "@/lib/auth/mobileAuth";

/**
 * Silent mobile session refresh.
 *
 * Mobile tokens carry a 30-day max age, but a technician's session is meant
 * to live until it is genuinely revoked (admin session reset, mobile access
 * switched off, account deactivated, or an explicit sign-out — all of which
 * clear or rotate Employee.mobileSessionId). This endpoint exchanges a
 * signature-valid token — of ANY age — for a fresh one bound to the SAME
 * server-side session, so token age alone never bounces a technician to the
 * login screen. Anything that revokes the session makes the stored
 * sessionId stop matching and the refresh fails with 401 SESSION_REVOKED.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";

  // Signature + shape only: pass an effectively unbounded max age so an
  // old-but-genuine token can still prove it belongs to the live session.
  const verified = verifyMobileToken(authHeader, Number.MAX_SAFE_INTEGER);
  if (!verified?.sessionId) {
    return NextResponse.json(
      { error: "Session is no longer valid. Please sign in again.", code: "SESSION_REVOKED" },
      { status: 401 }
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { id: verified.employeeId },
    select: {
      id: true,
      active: true,
      mobileLoginActive: true,
      mobileSessionId: true,
    },
  });

  if (
    !employee ||
    !employee.active ||
    !employee.mobileLoginActive ||
    employee.mobileSessionId !== verified.sessionId
  ) {
    return NextResponse.json(
      { error: "Session is no longer valid. Please sign in again.", code: "SESSION_REVOKED" },
      { status: 401 }
    );
  }

  const token = signMobileToken(employee.id, Date.now(), verified.sessionId);
  return NextResponse.json({ success: true, token });
}
