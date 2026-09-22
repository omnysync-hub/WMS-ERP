export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { POST as resetPasswordPost } from "../reset-password/route";

/**
 * POST /api/employees/[id]/mobile-login/reset-pin
 * Legacy alias for /api/employees/[id]/mobile-login/reset-password
 */
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  return resetPasswordPost(req, context);
}
