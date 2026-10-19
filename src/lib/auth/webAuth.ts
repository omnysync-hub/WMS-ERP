import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEVELOPMENT_DEMO_PASSWORD,
  DEVELOPMENT_DEMO_USERS,
  demoLoginEnabled,
} from "@/lib/auth/erpRoles";

export const ERP_SESSION_COOKIE = "workman_erp_session";
export const ERP_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export type AuthenticatedErpUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  designation: string;
  department: string;
  status: string;
  avatar: string;
  badgeColor: string;
  permissionOverrides: Record<string, boolean>;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  isDemo: boolean;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeLogin(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function validateErpPassword(password: string) {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter.";
  if (!/\d/.test(password)) return "Password must contain a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain a special character.";
  return null;
}

export async function ensureDevelopmentDemoUsers() {
  if (!demoLoginEnabled()) {
    const existingUsers = await prisma.erpUser.count({ where: { isDemo: false } });
    const bootstrapPassword = process.env.ERP_BOOTSTRAP_ADMIN_PASSWORD || "";
    if (existingUsers === 0 && bootstrapPassword) {
      const passwordError = validateErpPassword(bootstrapPassword);
      if (passwordError) throw new Error(`ERP_BOOTSTRAP_ADMIN_PASSWORD: ${passwordError}`);
      await prisma.erpUser.create({
        data: {
          name: process.env.ERP_BOOTSTRAP_ADMIN_NAME || "System Administrator",
          username: normalizeLogin(process.env.ERP_BOOTSTRAP_ADMIN_USERNAME || "admin"),
          email: normalizeLogin(process.env.ERP_BOOTSTRAP_ADMIN_EMAIL || "admin@workmanservices.pk"),
          passwordHash: await bcrypt.hash(bootstrapPassword, 12),
          role: "admin",
          designation: "System Administrator",
          department: "Management",
          avatar: "SA",
          badgeColor: "bg-purple-600 text-white",
          mustChangePassword: true,
        },
      });
    }
    return;
  }
  const passwordHash = await bcrypt.hash(DEVELOPMENT_DEMO_PASSWORD, 12);
  await Promise.all(
    DEVELOPMENT_DEMO_USERS.map((user) =>
      prisma.erpUser.upsert({
        where: { username: user.username },
        update: { isDemo: true },
        create: {
          ...user,
          passwordHash,
          mustChangePassword: false,
          isDemo: true,
        },
      })
    )
  );
}

export function publicErpUser(user: {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  designation: string;
  department: string;
  status: string;
  avatar: string;
  badgeColor: string;
  permissionOverrides: unknown;
  mustChangePassword: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  isDemo: boolean;
}): AuthenticatedErpUser {
  const overrides =
    user.permissionOverrides && typeof user.permissionOverrides === "object" && !Array.isArray(user.permissionOverrides)
      ? (user.permissionOverrides as Record<string, boolean>)
      : {};
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    designation: user.designation,
    department: user.department,
    status: user.status,
    avatar: user.avatar,
    badgeColor: user.badgeColor,
    permissionOverrides: overrides,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
    isDemo: user.isDemo,
  };
}

export async function createErpSession(
  userId: string,
  meta: { ipAddress?: string; userAgent?: string; deviceLabel?: string }
) {
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + ERP_SESSION_MAX_AGE_SECONDS * 1000);

  // One active browser session per account. A new login safely signs out the older device.
  await prisma.$transaction([
    prisma.erpSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.erpSession.create({
      data: {
        userId,
        tokenHash: tokenHash(token),
        expiresAt,
        ipAddress: meta.ipAddress?.slice(0, 120),
        userAgent: meta.userAgent?.slice(0, 500),
        deviceLabel: meta.deviceLabel?.slice(0, 120),
      },
    }),
  ]);

  return { token, expiresAt };
}

/**
 * Should the session cookie carry the `Secure` flag?
 * Browsers silently DROP a Secure cookie set over plain http, so login "succeeds" but the
 * next request has no session and bounces back to /login. Follow the real request protocol:
 *  - COOKIE_SECURE=true|false env overrides everything;
 *  - otherwise Secure only when the request arrived over https (direct, or via a proxy that
 *    sends X-Forwarded-Proto: https, e.g. nginx `proxy_set_header X-Forwarded-Proto $scheme;`).
 * When the site moves to HTTPS the flag turns on automatically.
 */
export function shouldUseSecureCookie(request?: Pick<NextRequest, "headers" | "nextUrl"> | null) {
  const override = (process.env.COOKIE_SECURE || "").trim().toLowerCase();
  if (override === "true" || override === "1") return true;
  if (override === "false" || override === "0") return false;
  if (!request) return process.env.NODE_ENV === "production";
  const forwardedProto = (request.headers.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
  if (forwardedProto) return forwardedProto === "https";
  return request.nextUrl?.protocol === "https:";
}

export function setErpSessionCookie(response: NextResponse, token: string, request?: NextRequest) {
  response.cookies.set(ERP_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    maxAge: ERP_SESSION_MAX_AGE_SECONDS,
  });
}

export function clearErpSessionCookie(response: NextResponse, request?: NextRequest) {
  response.cookies.set(ERP_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    maxAge: 0,
  });
}

export async function authenticateErpRequest(request: NextRequest) {
  const token = request.cookies.get(ERP_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.erpSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: true },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now() ||
    session.user.status !== "active"
  ) {
    return null;
  }
  return { session, user: publicErpUser(session.user) };
}

export async function revokeCurrentErpSession(request: NextRequest) {
  const token = request.cookies.get(ERP_SESSION_COOKIE)?.value;
  if (!token) return;
  await prisma.erpSession.updateMany({
    where: { tokenHash: tokenHash(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function verifyErpLogin(login: string, password: string) {
  const normalized = normalizeLogin(login);
  await ensureDevelopmentDemoUsers();
  const user = await prisma.erpUser.findFirst({
    where: {
      OR: [
        { username: { equals: normalized, mode: "insensitive" } },
        { email: { equals: normalized, mode: "insensitive" } },
      ],
    },
  });

  if (!user) {
    await bcrypt.compare(password || "", "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid");
    return { error: "Invalid username/email or password.", status: 401 as const };
  }
  if (user.isDemo && !demoLoginEnabled()) {
    return { error: "Invalid username/email or password.", status: 401 as const };
  }
  if (user.status !== "active") return { error: "This account is suspended. Contact an administrator.", status: 403 as const };
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return { error: `Too many attempts. Try again after ${user.lockedUntil.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`, status: 423 as const };
  }

  const valid = await bcrypt.compare(password || "", user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    await prisma.erpUser.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts >= MAX_FAILED_ATTEMPTS ? 0 : attempts,
        lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    return {
      error: attempts >= MAX_FAILED_ATTEMPTS
        ? `Account locked for ${LOCK_MINUTES} minutes after repeated failed attempts.`
        : "Invalid username/email or password.",
      status: attempts >= MAX_FAILED_ATTEMPTS ? (423 as const) : (401 as const),
    };
  }

  const updated = await prisma.erpUser.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  return { user: publicErpUser(updated) };
}

export function requestIp(request: NextRequest) {
  // Prefer X-Real-IP (set by nginx / Vercel to the actual peer, not client-spoofable).
  return (request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || "")
    .split(",")[0]
    .trim();
}
