export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/lib/services/AuditService";
import {
  verifyMobileToken,
  resolveCaller,
  AuthenticatedCaller,
  ADMIN_HR_ROLES,
  EXPECTED_EMBEDDING_DIMENSION,
  ENROLLMENT_COOLDOWN_SECONDS,
} from "@/lib/auth/mobileAuth";

/**
 * POST /api/employees/[id]/enrollment
 * Stores on-device computed 512-dimensional facial embeddings for mobile biometric attendance.
 *
 * Security:
 * - Requires authentication (Bearer wms_mobile_... or x-employee-id / x-actor-role headers)
 * - Self-enrollment scope: caller.id must match params.id
 * - Admin/HR override: roles in ADMIN_HR_ROLES can enroll for any employee
 * - Rate limited: minimum 30 seconds cooldown between successive re-enrollments for non-admin callers
 * - Dimension validated: strictly 512 finite floats
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id;

    // 1. Resolve & Authenticate Caller
    const caller = await resolveCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication credentials." },
        { status: 401 }
      );
    }

    // 2. Authorization / Scope check
    const isSelf = caller.id === employeeId;
    if (!isSelf && !caller.isAdminOrHr) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to enroll or modify biometric data for another employee." },
        { status: 403 }
      );
    }

    // 3. Employee existence and active status verification
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        faceEnrolled: true,
        faceEnrolledAt: true,
        faceEnrollmentCount: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: `Employee with ID "${employeeId}" not found.` },
        { status: 404 }
      );
    }

    if (!employee.active) {
      return NextResponse.json(
        { error: "Cannot enroll or update biometric data for a deactivated or terminated employee." },
        { status: 403 }
      );
    }

    // 4. Rate Limiting / Cooldown Guard (30s window per employee for non-admin self-enrollment)
    if (employee.faceEnrolledAt && !caller.isAdminOrHr) {
      const msSinceLast = Date.now() - new Date(employee.faceEnrolledAt).getTime();
      if (msSinceLast < ENROLLMENT_COOLDOWN_SECONDS * 1000) {
        const remainingSeconds = Math.ceil((ENROLLMENT_COOLDOWN_SECONDS * 1000 - msSinceLast) / 1000);
        return NextResponse.json(
          {
            error: `Re-enrollment rate limit exceeded. Please wait ${remainingSeconds}s before submitting another face scan.`,
            retryAfterSeconds: remainingSeconds,
          },
          {
            status: 429,
            headers: { "Retry-After": remainingSeconds.toString() },
          }
        );
      }
    }

    // 5. Payload & Dimension Validation
    const body = await req.json();
    const { embedding, enrolledAt, actorName } = body;

    if (!Array.isArray(embedding)) {
      return NextResponse.json(
        { error: "Invalid payload: 'embedding' must be an array of numbers." },
        { status: 400 }
      );
    }

    if (embedding.length !== EXPECTED_EMBEDDING_DIMENSION) {
      return NextResponse.json(
        {
          error: `Invalid embedding dimensions: Expected exactly ${EXPECTED_EMBEDDING_DIMENSION}-dimensional vector (MobileFaceNet/ArcFace standard), but received ${embedding.length} elements.`,
          expectedDimension: EXPECTED_EMBEDDING_DIMENSION,
          receivedDimension: embedding.length,
        },
        { status: 400 }
      );
    }

    const hasInvalidFloats = embedding.some(
      (val) => typeof val !== "number" || isNaN(val) || !isFinite(val)
    );
    if (hasInvalidFloats) {
      return NextResponse.json(
        { error: "Invalid embedding: all 512 elements must be finite numeric values." },
        { status: 400 }
      );
    }

    // 6. Persistence & Versioning
    const isReenrollment = employee.faceEnrolled === true;
    const resolvedEnrolledAt = enrolledAt ? new Date(enrolledAt) : new Date();

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        faceEmbedding: embedding,
        faceEnrolled: true,
        faceEnrolledAt: resolvedEnrolledAt,
        faceEnrollmentCount: { increment: 1 },
      },
      select: {
        id: true,
        name: true,
        faceEnrolled: true,
        faceEnrolledAt: true,
        faceEnrollmentCount: true,
      },
    });

    // 7. Audit Logging with Authoritative Caller Identity
    await AuditService.logActivity({
      actorName: actorName || caller.name || (isSelf ? employee.name : "HR Administrator"),
      actorRole: caller.role,
      actorId: caller.id,
      category: "DATA_MUTATION",
      action: isReenrollment ? "FACE_BIOMETRIC_REENROLLED" : "FACE_BIOMETRIC_ENROLLED",
      target: `Employee: ${employee.name} (${employee.id})`,
      metadata: {
        employeeId: employee.id,
        callerId: caller.id,
        callerRole: caller.role,
        isSelfEnrollment: isSelf,
        isAdminOverride: !isSelf && caller.isAdminOrHr,
        embeddingDimension: EXPECTED_EMBEDDING_DIMENSION,
        enrolledAt: resolvedEnrolledAt.toISOString(),
        previousEnrolledAt: employee.faceEnrolledAt?.toISOString() || null,
        enrollmentCount: updated.faceEnrollmentCount,
        isReenrollment,
      },
    });

    return NextResponse.json({
      success: true,
      faceEnrolled: updated.faceEnrolled,
      enrolledAt: updated.faceEnrolledAt,
      enrollmentCount: updated.faceEnrollmentCount,
      isReenrollment,
      message: isReenrollment
        ? "Face embedding successfully updated (re-enrolled)."
        : "Face embedding successfully enrolled.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process face embedding enrollment." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/employees/[id]/enrollment
 * Returns current enrollment status and metadata (without returning the large 512-float vector).
 *
 * Security:
 * - Requires authentication
 * - Only the target employee (self) or an admin/HR role may view enrollment status
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id;
    const url = req.url ? new URL(req.url) : null;
    const includeEmbedding = url ? url.searchParams.get("includeEmbedding") === "true" : false;

    // 1. Resolve & Authenticate Caller
    const caller = await resolveCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication credentials." },
        { status: 401 }
      );
    }

    // 2. Authorization / Scope check
    const isSelf = caller.id === employeeId;
    if (!isSelf && !caller.isAdminOrHr) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view biometric enrollment data for another employee." },
        { status: 403 }
      );
    }

    // 3. Employee lookup
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        role: true,
        department: true,
        active: true,
        faceEnrolled: true,
        faceEnrolledAt: true,
        faceEnrollmentCount: true,
        faceEmbedding: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: `Employee with ID "${employeeId}" not found.` },
        { status: 404 }
      );
    }

    const hasValidEmbedding =
      Array.isArray(employee.faceEmbedding) &&
      employee.faceEmbedding.length === EXPECTED_EMBEDDING_DIMENSION;

    return NextResponse.json({
      employeeId: employee.id,
      name: employee.name,
      role: employee.role,
      active: employee.active,
      faceEnrolled: employee.faceEnrolled,
      faceEnrolledAt: employee.faceEnrolledAt,
      faceEnrollmentCount: employee.faceEnrollmentCount,
      enrollmentCount: employee.faceEnrollmentCount,
      hasEmbedding: hasValidEmbedding,
      embeddingDimensions: employee.faceEmbedding?.length || 0,
      expectedDimension: EXPECTED_EMBEDDING_DIMENSION,
      // Self-only: mobile caches this for on-device cosine match (avoid round-trip mid check-in)
      ...(includeEmbedding && isSelf && hasValidEmbedding
        ? { embedding: employee.faceEmbedding }
        : {}),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch face enrollment status." },
      { status: 500 }
    );
  }
}
