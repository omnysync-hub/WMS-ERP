import { NextRequest, NextResponse } from "next/server";
import { JobReportService } from "@/lib/services/JobReportService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = (searchParams.get("period") || "today") as any;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const technicianId = searchParams.get("technicianId") || undefined;
    const statusGroup = (searchParams.get("statusGroup") || "all") as any;
    const jobType = searchParams.get("jobType") || undefined;

    const report = await JobReportService.generateReport({
      period,
      startDate,
      endDate,
      technicianId,
      statusGroup,
      jobType,
    });

    return NextResponse.json(report);
  } catch (err: any) {
    console.error("Job Reports generation error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate report" }, { status: 500 });
  }
}
