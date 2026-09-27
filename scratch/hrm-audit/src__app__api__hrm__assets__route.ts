export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { HrmService } from "@/lib/services/HrmService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") as any) || undefined;
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search") || undefined;

    const assets = await HrmService.listAssets({ status, category, search });
    return NextResponse.json({ assets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "create";

    if (action === "create") {
      const asset = await HrmService.createAsset({
        tag: body.tag,
        name: body.name,
        category: body.category,
        purchaseDate: body.purchaseDate,
      });
      return NextResponse.json({ asset }, { status: 201 });
    } else if (action === "assign") {
      const asset = await HrmService.assignAsset({
        assetId: body.assetId,
        employeeId: body.employeeId,
        conditionNotes: body.conditionNotes,
        assignedBy: body.assignedBy || "Operations Asset Manager",
      });
      return NextResponse.json({ asset });
    } else if (action === "return") {
      const asset = await HrmService.returnAsset({
        assetId: body.assetId,
        conditionNotes: body.conditionNotes,
      });
      return NextResponse.json({ asset });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
