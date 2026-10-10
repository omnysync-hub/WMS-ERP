import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isKnownErpRole } from "@/lib/auth/erpRoles";
import { authenticateErpRequest, publicErpUser, validateErpPassword } from "@/lib/auth/webAuth";

async function requireAdmin(request: NextRequest) {
  const auth = await authenticateErpRequest(request);
  if (!auth) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  if (auth.user.role !== "admin") return { error: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }) };
  return { auth };
}

export async function GET(request: NextRequest) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;
  const users = await prisma.erpUser.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] });
  return NextResponse.json({ users: users.map(publicErpUser) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const username = String(body.username || "").trim().toLowerCase();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const role = String(body.role || "").trim().toLowerCase();
  const passwordError = validateErpPassword(password);
  if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "Enter a valid full name." }, { status: 400 });
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) return NextResponse.json({ error: "Username must be 3–40 characters using letters, numbers, dot, dash, or underscore." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!isKnownErpRole(role)) return NextResponse.json({ error: "Select a valid system role." }, { status: 400 });
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

  const duplicate = await prisma.erpUser.findFirst({
    where: { OR: [{ username: { equals: username, mode: "insensitive" } }, { email: { equals: email, mode: "insensitive" } }] },
    select: { username: true, email: true },
  });
  if (duplicate) return NextResponse.json({ error: "That username or email is already in use." }, { status: 409 });

  const user = await prisma.erpUser.create({
    data: {
      name,
      username,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role,
      designation: String(body.designation || "").trim().slice(0, 100),
      department: String(body.department || "").trim().slice(0, 100),
      status: body.status === "suspended" ? "suspended" : "active",
      avatar: String(body.avatar || name.split(/\s+/).map((part: string) => part[0]).join("").slice(0, 2)).toUpperCase(),
      badgeColor: String(body.badgeColor || "bg-slate-600 text-white").slice(0, 80),
      mustChangePassword: body.mustChangePassword !== false,
    },
  });
  return NextResponse.json({ user: publicErpUser(user) }, { status: 201 });
}
