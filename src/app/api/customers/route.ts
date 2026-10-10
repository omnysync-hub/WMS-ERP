export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobsPermission } from "@/lib/auth/erpActor";

export async function GET(req: NextRequest) {
  try {
    const gate = await requireJobsPermission(req, "jobs.view_directory");
    if (gate.error) return gate.error;
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
    const gate = await requireJobsPermission(req, "jobs.create_job");
    if (gate.error) return gate.error;
    const body = await req.json();
    const { name, phone, secPhone, email, addressText, lat, lng } = body;

    if (
      typeof name !== "string" || !name.trim() || name.trim().length > 160 ||
      typeof phone !== "string" || !phone.trim() ||
      typeof addressText !== "string" || !addressText.trim() || addressText.trim().length > 1000
    ) {
      return NextResponse.json(
        { error: "Customer name, phone number, and address are required." },
        { status: 400 }
      );
    }

    const primaryDigits = String(phone).replace(/\D/g, "");
    if (primaryDigits.length !== 11) {
      return NextResponse.json(
        { error: "Customer primary phone number must be exactly 11 digits (e.g. 03001234567)." },
        { status: 400 }
      );
    }

    if (secPhone !== undefined && secPhone !== null && typeof secPhone !== "string") {
      return NextResponse.json({ error: "Secondary phone number must be text." }, { status: 400 });
    }
    if (typeof secPhone === "string" && secPhone.trim()) {
      const secDigits = String(secPhone).replace(/\D/g, "");
      if (secDigits.length !== 11) {
        return NextResponse.json(
          { error: "Secondary phone number must be exactly 11 digits (e.g. 03211234567)." },
          { status: 400 }
        );
      }
    }

    // Combine primary and secondary phone if secondary provided
    const combinedPhone = typeof secPhone === "string" && secPhone.trim()
      ? `${phone.trim()} / ${secPhone.trim()}`
      : phone.trim();

    if (email !== undefined && email !== null && typeof email !== "string") {
      return NextResponse.json({ error: "Email address must be text." }, { status: 400 });
    }
    const cleanEmail = typeof email === "string" ? email.trim() : "";
    if (cleanEmail && (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) {
      return NextResponse.json({ error: "Enter a valid customer email address." }, { status: 400 });
    }

    const parsedLat = lat === undefined || lat === null || lat === "" ? null : Number(lat);
    const parsedLng = lng === undefined || lng === null || lng === "" ? null : Number(lng);
    if (
      (parsedLat !== null && (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90)) ||
      (parsedLng !== null && (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180))
    ) {
      return NextResponse.json({ error: "Customer coordinates are outside the valid latitude/longitude range." }, { status: 400 });
    }
    if ((parsedLat === null) !== (parsedLng === null)) {
      return NextResponse.json({ error: "Provide both latitude and longitude, or neither." }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: combinedPhone,
        email: cleanEmail || null,
        addressText: addressText.trim(),
        lat: parsedLat,
        lng: parsedLng,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
