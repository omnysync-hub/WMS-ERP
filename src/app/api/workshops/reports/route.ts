export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { WorkshopService } from "@/lib/services/WorkshopService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get("reportType") as any;
    const workshopType = searchParams.get("workshopType") || undefined;
    const search = searchParams.get("search") || undefined;

    if (!reportType) {
      return NextResponse.json(
        { error: "Query parameter 'reportType' is required." },
        { status: 400 }
      );
    }

    const data = await WorkshopService.getReports(reportType, {
      workshopType,
      search,
    });

    return NextResponse.json({ success: true, reportType, count: Array.isArray(data) ? data.length : 1, data });
  } catch (err: any) {
    console.error("GET /api/workshops/reports error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate workshop report" }, { status: 500 });
  }
}
