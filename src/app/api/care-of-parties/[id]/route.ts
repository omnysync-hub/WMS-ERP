import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { companyName, personName, phone } = body;

    if (!companyName || !companyName.trim()) {
      return NextResponse.json(
        { error: "Company name is required." },
        { status: 400 }
      );
    }

    const updated = await prisma.careOfParty.update({
      where: { id },
      data: {
        companyName: companyName.trim(),
        personName: personName?.trim() || "",
        phone: phone?.trim() || null,
      },
    });

    return NextResponse.json({ careOfParty: updated });
  } catch (error: any) {
    console.error("Failed updating care-of party:", error);
    return NextResponse.json(
      { error: "Failed to update care-of party", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Unlink any jobs before deletion so we don't break referential integrity
    await prisma.job.updateMany({
      where: { careOfPartyId: id },
      data: { careOfPartyId: null },
    });

    await prisma.careOfParty.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Care-of party deleted" });
  } catch (error: any) {
    console.error("Failed deleting care-of party:", error);
    return NextResponse.json(
      { error: "Failed to delete care-of party", details: error.message },
      { status: 500 }
    );
  }
}
