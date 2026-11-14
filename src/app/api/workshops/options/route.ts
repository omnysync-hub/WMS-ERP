export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-actor-role, x-actor-name, x-actor-id, *",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const [staff, products, customers] = await Promise.all([
      prisma.employee.findMany({
        where: {
          status: { equals: "Active", mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          designation: true,
          role: true,
          department: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.product.findMany({
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          stockQuantity: true,
          unitPrice: true,
          costPrice: true,
        },
        orderBy: { name: "asc" },
        take: 500,
      }),
      prisma.customer.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          addressText: true,
        },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        staff,
        products,
        customers: customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.addressText,
        })),
      },
    });
  } catch (err: any) {
    console.error("GET /api/workshops/options error:", err);
    return NextResponse.json({ error: err.message || "Failed to load options" }, { status: 500 });
  }
}
