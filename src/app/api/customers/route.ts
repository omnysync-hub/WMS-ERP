import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const where: any = {};
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { addressText: { contains: q } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(customers);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, secPhone, email, addressText, lat, lng } = body;

    if (!name || !phone || !addressText) {
      return NextResponse.json(
        { error: "Customer name, phone number, and address are required." },
        { status: 400 }
      );
    }

    // Combine primary and secondary phone if secondary provided
    const combinedPhone = secPhone?.trim()
      ? `${phone.trim()} / ${secPhone.trim()}`
      : phone.trim();

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: combinedPhone,
        email: email?.trim() || null,
        addressText: addressText.trim(),
        lat: lat !== undefined ? Number(lat) : 25.2048,
        lng: lng !== undefined ? Number(lng) : 55.2708,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
