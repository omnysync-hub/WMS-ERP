import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isKnownErpRole } from "@/lib/auth/erpRoles";
import { authenticateErpRequest, publicErpUser, validateErpPassword } from "@/lib/auth/webAuth";

async function admin(request: NextRequest) {
  const auth = await authenticateErpRequest(request);
  if (!auth) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  if (auth.user.role !== "admin") return { error: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }) };
  return { auth };
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await admin(request);
  if (gate.error) return gate.error;
  const { id } = await context.params;
  const current = await prisma.erpUser.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const data: Prisma.ErpUserUpdateInput = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "Enter a valid full name." }, { status: 400 });
    data.name = name;
  }
  if (body.username !== undefined) {
    const username = String(body.username).trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) return NextResponse.json({ error: "Enter a valid username." }, { status: 400 });
    data.username = username;
  }
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    data.email = email;
  }
  if (body.role !== undefined) {
    const role = String(body.role).toLowerCase();
    if (!isKnownErpRole(role)) return NextResponse.json({ error: "Select a valid system role." }, { status: 400 });
    data.role = role;
  }
  if (body.status !== undefined) {
    if (!["active", "suspended"].includes(body.status)) return NextResponse.json({ error: "Invalid account status." }, { status: 400 });
    if (current.role === "admin" && body.status === "suspended") {
      const activeAdmins = await prisma.erpUser.count({ where: { role: "admin", status: "active" } });
      if (activeAdmins <= 1) return NextResponse.json({ error: "The last active administrator cannot be suspended." }, { status: 409 });
    }
    data.status = body.status;
  }
  if (body.designation !== undefined) data.designation = String(body.designation).trim().slice(0, 100);
  if (body.department !== undefined) data.department = String(body.department).trim().slice(0, 100);
  if (body.badgeColor !== undefined) data.badgeColor = String(body.badgeColor).slice(0, 80);
  if (body.permissionOverrides !== undefined) data.permissionOverrides = body.permissionOverrides;
  if (body.password !== undefined && String(body.password)) {
    const password = String(body.password);
    const error = validateErpPassword(password);
    if (error) return NextResponse.json({ error }, { status: 400 });
    data.passwordHash = await bcrypt.hash(password, 12);
    data.passwordChangedAt = new Date();
    data.mustChangePassword = body.mustChangePassword !== false;
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.erpUser.update({ where: { id }, data });
      if (body.password || body.status === "suspended" || (body.role && body.role !== current.role)) {
        await tx.erpSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return updated;
    });
    return NextResponse.json({ user: publicErpUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That username or email is already in use." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await admin(request);
  if (gate.error) return gate.error;
  const { id } = await context.params;
  const user = await prisma.erpUser.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (user.role === "admin") return NextResponse.json({ error: "Administrator accounts must be suspended, not deleted." }, { status: 409 });
  if (gate.auth?.user.id === id) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 409 });
  await prisma.erpUser.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
