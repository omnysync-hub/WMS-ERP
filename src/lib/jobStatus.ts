/**
 * Shared job-status rules (safe for both server services and client components — no prisma).
 */

/** Pre-start statuses: technician can be swapped directly (assign / assign_technicians). */
export const JOB_PRE_START_STATUSES = ["Created", "Assigned"] as const;

/**
 * Mid-job statuses: changing technician must go through `reassign`
 * (creates a successor job and marks the old one TechnicianReassigned).
 */
export const JOB_REASSIGNABLE_STATUSES = ["Accepted", "InProgress", "Paused"] as const;

/**
 * Terminal / locked statuses: no new service or item lines, no technician changes.
 * (Accounting corrections after auditor send-back happen in CompletedPendingVerification.)
 */
export const JOB_TERMINAL_STATUSES = [
  "Finalized",
  "Verified",
  "Cancelled",
  "Canceled",
  "TechnicianReassigned",
  "Closed",
] as const;

/** Post-completion statuses where the field crew is done (no technician change either). */
export const JOB_POST_COMPLETION_STATUSES = [
  "AwaitingFeedback",
  "CompletedPendingVerification",
] as const;

export function isReassignableStatus(status?: string | null): boolean {
  return (JOB_REASSIGNABLE_STATUSES as readonly string[]).includes(String(status || ""));
}

export function isPreStartStatus(status?: string | null): boolean {
  return !status || (JOB_PRE_START_STATUSES as readonly string[]).includes(String(status));
}

export function isTerminalJobStatus(status?: string | null): boolean {
  return (JOB_TERMINAL_STATUSES as readonly string[]).includes(String(status || ""));
}

/** Technician can be assigned / changed (directly pre-start, or via reassign mid-job). */
export function canChangeTechnician(job: { status?: string | null; finalizedAt?: unknown }): boolean {
  if (job.finalizedAt) return false;
  return isPreStartStatus(job.status) || isReassignableStatus(job.status);
}

/** Service / item lines can be added (not finalized, not terminal). */
export function canAddServiceOrItem(job: { status?: string | null; finalizedAt?: unknown }): boolean {
  if (job.finalizedAt) return false;
  return !isTerminalJobStatus(job.status);
}
