export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";

export async function GET(req: NextRequest) {
  try {
    const analytics = await HrmService.getHrAnalytics();
    return NextResponse.json({ analytics });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
