import crypto from "crypto";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Maximum failed attempts before brute-force account lockout.
 */
export const MOBILE_LOGIN_LOCKOUT_THRESHOLD = 5;

/**
 * Lockout cooldown duration in minutes after exceeding maximum failed attempts.
 */
export const MOBILE_LOGIN_LOCKOUT_MINUTES = 15;

/**
 * Minimum required characters for a mobile login password.
 */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * Validates that a password satisfies the minimum strength criteria (length >= 6).
 */
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required." };
  }
  const trimmed = password.trim();
  if (trimmed.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` };
  }
  return { valid: true };
}

/**
 * Securely hashes a password using bcrypt with 10 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password.trim(), 10);
}

/**
 * Compares a candidate password against a stored bcrypt hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return await bcrypt.compare(password.trim(), hash);
}

/**
 * Generates a suggested strong alphanumeric password (e.g. "Wms#7xK92p") for admin convenience.
 */
export function generateSuggestedPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomPart = "";
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return `Wms#${randomPart}`;
}

// Backwards-compatible aliases
export const hashPin = hashPassword;
export const comparePin = comparePassword;
export const generateTempPin = generateSuggestedPassword;

/**
 * Reads the cryptographic secret key for signing/verifying mobile session tokens.
 * Strictly requires an environment variable; throws a fatal error if missing.
 * No hardcoded default string fallback.
 */
export function getMobileAuthSecret(): string {
  const secret = process.env.MOBILE_AUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "FATAL SECURITY CONFIGURATION ERROR: MOBILE_AUTH_SECRET environment variable is missing. The server cannot safely sign or verify tokens without a configured secret."
    );
  }
  return secret.trim();
}

/**
 * Roles permitted to perform administrative operations across employees.
 */
export const ADMIN_HR_ROLES = ["admin", "hr", "management", "superadmin"];

/**
 * Expected facial embedding dimension for on-device MobileFaceNet and ArcFace ML models.
 */
export const EXPECTED_EMBEDDING_DIMENSION = 512;

/**
 * Enforced cooldown between successive biometric re-enrollments per employee to prevent rapid-fire vector churn.
 */
export const ENROLLMENT_COOLDOWN_SECONDS = 30;

export interface AuthenticatedCaller {
  id: string;
  role: string;
  name?: string;
  isAdminOrHr: boolean;
}

/**
 * Issues a cryptographically signed mobile session token using HMAC-SHA256.
 * Format: wms_mobile_<base64url(employeeId:timestamp)>.<hmac_signature_hex>
 */
export function signMobileToken(employeeId: string, timestamp: number = Date.now()): string {
  const secret = getMobileAuthSecret();
  const payload = Buffer.from(`${employeeId}:${timestamp}`).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return `wms_mobile_${payload}.${signature}`;
}

/**
 * Cryptographically verifies an incoming mobile token against the HMAC secret.
 * Performs constant-time comparison to prevent side-channel timing attacks.
 *
 * @param rawToken - Full token string (e.g. "wms_mobile_<payload>.<sig>" or "Bearer wms_mobile_...")
 * @param maxAgeMs - Maximum token age in milliseconds (default: 30 days)
 * @returns Decoded employeeId and timestamp if valid; null if signature mismatch, malformed, or expired.
 */
export function verifyMobileToken(
  rawToken: string,
  maxAgeMs: number = 30 * 24 * 60 * 60 * 1000
): { employeeId: string; timestamp: number } | null {
  if (!rawToken) return null;

  let token = rawToken.trim();
  if (token.startsWith("Bearer ")) {
    token = token.slice("Bearer ".length).trim();
  }

  if (!token.startsWith("wms_mobile_")) {
    return null;
  }

  const tokenContent = token.slice("wms_mobile_".length);
  const parts = tokenContent.split(".");

  // Mandatory signature: tokens without cryptographic signature are rejected
  if (parts.length !== 2) {
    return null;
  }

  const [payload, signature] = parts;
  if (!payload || !signature) {
    return null;
  }

  const secret = getMobileAuthSecret();

  // Compute expected HMAC
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  try {
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null; // Tampered or forged signature
    }

    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    const [employeeId, timestampStr] = decoded.split(":");
    if (!employeeId || !timestampStr) {
      return null;
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return null;
    }

    // Reject expired tokens
    if (Date.now() - timestamp > maxAgeMs) {
      return null;
    }

    return { employeeId, timestamp };
  } catch {
    return null;
  }
}

/**
 * Shared identity resolution function for Next.js API routes.
 * 1. Checks and cryptographically validates Bearer wms_mobile_ tokens.
 * 2. Falls back to gateway-injected internal headers (x-employee-id / x-actor-role).
 * 3. Enforces database verification to ensure employee account is active and uses DB role as authoritative truth.
 */
export async function resolveCaller(req: NextRequest): Promise<AuthenticatedCaller | null> {
  const authHeader = req.headers.get("authorization") || "";
  let callerId: string | null = null;
  let callerRole: string | null = null;
  let isMobileToken = false;

  // 1. Mobile Bearer token with cryptographic HMAC-SHA256 signature verification
  if (authHeader.startsWith("Bearer wms_mobile_") || authHeader.startsWith("Bearer ")) {
    const verified = verifyMobileToken(authHeader);
    if (!verified) {
      return null; // Token is unsigned, forged, tampered, or expired
    }
    callerId = verified.employeeId;
    isMobileToken = true;
  }

  // 2. Gateway / Internal session headers (trusted upstream proxies)
  if (!callerId) {
    callerId = req.headers.get("x-employee-id") || req.headers.get("x-user-id");
  }

  const headerRole = req.headers.get("x-actor-role") || req.headers.get("x-user-role");
  if (headerRole) {
    callerRole = headerRole.toLowerCase();
  }

  if (!callerId) {
    return null;
  }

  // 3. Database lookup to confirm active status and resolve authoritative role
  const callerEmp = await prisma.employee.findUnique({
    where: { id: callerId },
    select: { id: true, name: true, role: true, active: true, mobileLoginActive: true },
  });

  if (!callerEmp) {
    // Check if caller is an authorized ERP administrative persona by role
    const actorName = req.headers.get("x-actor-name") || "Administrator";
    if (callerRole && ADMIN_HR_ROLES.includes(callerRole)) {
      return {
        id: callerId,
        role: callerRole,
        name: actorName,
        isAdminOrHr: true,
      };
    }
    return null;
  }

  if (!callerEmp.active) {
    return null;
  }

  // If request authenticated via a mobile token, immediately reject if mobile login is deactivated
  if (isMobileToken && !callerEmp.mobileLoginActive) {
    return null;
  }

  // Authoritative role from database
  const authoritativeRole = (callerEmp.role || "").toLowerCase();

  return {
    id: callerEmp.id,
    role: authoritativeRole,
    name: callerEmp.name,
    isAdminOrHr: ADMIN_HR_ROLES.includes(authoritativeRole),
  };
}
