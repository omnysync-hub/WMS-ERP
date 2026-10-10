import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateErpRequest, validateErpPassword } from "@/lib/auth/webAuth";

export async function POST(request: NextRequest) {
  const auth = await authenticateErpRequest(request);
  if (!auth) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  const error = validateErpPassword(newPassword);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (currentPassword === newPassword) return NextResponse.json({ error: "Choose a password different from the current one." }, { status: 400 });

  const user = await prisma.erpUser.findUnique({ where: { id: auth.user.id } });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.erpUser.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12), passwordChangedAt: new Date(), mustChangePassword: false },
    }),
    prisma.erpSession.updateMany({
      where: { userId: user.id, id: { not: auth.session.id }, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
