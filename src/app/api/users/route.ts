import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicErpUser, validateErpPassword } from "@/lib/auth/webAuth";
import { effectiveMapForUser, isAssignableWebRole, keysBeyondActor, sanitizePermissionMap } from "@/lib/auth/roleStore";
import { logAdminChange, requireUserAdmin } from "@/lib/auth/userAdminGate";

export async function GET(request: NextRequest) {
  const gate = await requireUserAdmin(request, ["settings.manage_users", "settings.manage_roles"]);
  if (gate.error) return gate.error;
  const users = await prisma.erpUser.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] });
  return NextResponse.json({ users: users.map(publicErpUser) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const gate = await requireUserAdmin(request, ["settings.manage_users"]);
  if (gate.error) return gate.error;
  const { ctx } = gate;
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const username = String(body.username || "").trim().toLowerCase();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const role = String(body.role || "").trim().toLowerCase();
  const permissionOverrides = sanitizePermissionMap(body.permissionOverrides);
  const passwordError = validateErpPassword(password);
  if (name.length > 0 && (name.length < 2 || name.length > 100)) return NextResponse.json({ error: "Full name must be between 2 and 100 characters if provided." }, { status: 400 });
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) return NextResponse.json({ error: "Username must be 3–40 characters using letters, numbers, dot, dash, or underscore." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!(await isAssignableWebRole(role))) return NextResponse.json({ error: "Select a valid role." }, { status: 400 });
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

  // No privilege escalation: a non-admin can only create users with permissions they hold themselves.
  if (!ctx.isAdmin) {
    if (role === "admin") return NextResponse.json({ error: "Only an administrator can create administrator accounts." }, { status: 403 });
    const beyond = keysBeyondActor(ctx.actorMap, await effectiveMapForUser({ role, permissionOverrides }));
    if (beyond.length) {
      return NextResponse.json({ error: `You cannot grant permissions you do not hold: ${beyond.join(", ")}`, code: "PRIVILEGE_ESCALATION" }, { status: 403 });
    }
  }

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
      avatar: String(body.avatar || name.split(/\s+/).map((part: string) => part[0]).join("").slice(0, 2) || username.slice(0, 2)).toUpperCase().slice(0, 4),
      badgeColor: String(body.badgeColor || "bg-slate-600 text-white").slice(0, 80),
      permissionOverrides: Object.keys(permissionOverrides).length ? permissionOverrides : undefined,
      mustChangePassword: body.mustChangePassword !== false,
    },
  });
  await logAdminChange(ctx, `Created user @${user.username} with role '${role}'`, `ErpUser:${user.id}`);
  return NextResponse.json({ user: publicErpUser(user) }, { status: 201 });
}
