import { NextRequest, NextResponse } from "next/server";
import { requireJobsPermission } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase();

    const parties = await prisma.careOfParty.findMany({
      include: {
        _count: {
          select: { jobs: true },
        },
      },
      orderBy: {
        companyName: "asc",
      },
    });

    const filtered = search
      ? parties.filter(
          (p) =>
            p.companyName.toLowerCase().includes(search) ||
            p.personName?.toLowerCase().includes(search) ||
            p.phone?.toLowerCase().includes(search)
        )
      : parties;

    return NextResponse.json({
      careOfParties: filtered.map((p) => ({
        id: p.id,
        companyName: p.companyName,
        personName: p.personName,
        phone: p.phone,
        jobsCount: p._count.jobs,
        createdAt: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Failed fetching care-of parties:", error);
    return NextResponse.json(
      { error: "Failed to retrieve care-of parties", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireJobsPermission(request, "jobs.manage");
  if (gate.error) return gate.error;
  try {
    const body = await request.json();
    const { companyName, personName, phone } = body;

    if (!companyName || !companyName.trim()) {
      return NextResponse.json(
        { error: "Company name is required." },
        { status: 400 }
      );
    }

    // Check if duplicate company name exists
    const existing = await prisma.careOfParty.findFirst({
      where: {
        companyName: {
          equals: companyName.trim(),
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      // Update contact person and phone if missing
      const updated = await prisma.careOfParty.update({
        where: { id: existing.id },
        data: {
          personName: personName?.trim() || existing.personName,
          phone: phone?.trim() !== undefined ? phone.trim() : existing.phone,
        },
      });
      return NextResponse.json({ careOfParty: updated, isExisting: true });
    }

    const careOfParty = await prisma.careOfParty.create({
      data: {
        companyName: companyName.trim(),
        personName: personName?.trim() || "",
        phone: phone?.trim() || null,
      },
    });

    return NextResponse.json({ careOfParty, isExisting: false }, { status: 201 });
  } catch (error: any) {
    console.error("Failed creating care-of party:", error);
    return NextResponse.json(
      { error: "Failed to create care-of party", details: error.message },
      { status: 500 }
    );
  }
}
