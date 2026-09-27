const fs = require("fs");
const path = "src/lib/services/JobsService.ts";
let s = fs.readFileSync(path, "utf8");

// Replace assignTechnician to also upsert JobAssignment
const oldAssign = `  static async assignTechnician(jobId: string, technicianId: string, assignedBy: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");

    if (job.finalizedAt) {
      throw new Error("Job is finalized and locked. Edits are rejected.");
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        assignedTechnicianId: technicianId,
        status: "Assigned",
      },
      include: { assignedTechnician: true, customer: true },
    });

    await this.logStatusChange(jobId, job.status, "Assigned", assignedBy, {
      assignedTechnicianId: technicianId,
    });

    // Automatically send mobile app dispatch request & push notification to the technician's device
    try {
      await MobilePushService.sendAppRequest({
        recipientId: technicianId,
        senderName: assignedBy,
        senderRole: "dispatcher",
        type: "JOB_DISPATCH",
        title: \`New Job Assigned: \${updated.jobNumber}\`,
        body: \`You have been assigned to \${updated.customer?.name || "Customer"} for \${updated.jobType}. Tap to review and accept.\`,
        priority: "high",
        actionRequired: true,
        payload: {
          jobId: updated.id,
          jobNumber: updated.jobNumber,
          customerName: updated.customer?.name,
          customerPhone: updated.customer?.phone,
          addressText: updated.customer?.addressText,
          lat: updated.customer?.lat,
          lng: updated.customer?.lng,
          jobType: updated.jobType,
          remarks: updated.remarks,
        },
      });
    } catch (e) {
      console.error("[JobsService] Failed to dispatch mobile push for job assignment:", e);
    }

    return updated;
  }`;

const newAssign = `  static async assignTechnician(jobId: string, technicianId: string, assignedBy: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");

    if (job.finalizedAt) {
      throw new Error("Job is finalized and locked. Edits are rejected.");
    }

    // Mid-job reassignment must use reassignTechnician (creates successor job)
    const midJobStatuses = ["Accepted", "InProgress", "Paused"];
    if (
      job.assignedTechnicianId &&
      job.assignedTechnicianId !== technicianId &&
      midJobStatuses.includes(job.status)
    ) {
      throw new Error(
        "Mid-job technician change requires reassignment (creates a new linked job). Use action 'reassign'."
      );
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        assignedTechnicianId: technicianId,
        status: job.status === "Created" || !job.assignedTechnicianId ? "Assigned" : job.status,
      },
      include: { assignedTechnician: true, customer: true, assignments: true },
    });

    await prisma.jobAssignment.upsert({
      where: { jobId_technicianId: { jobId, technicianId } },
      create: {
        jobId,
        technicianId,
        role: "primary",
        status: "Assigned",
        assignedBy,
      },
      update: {
        role: "primary",
        status: "Assigned",
        assignedBy,
        acceptedAt: null,
      },
    });

    // Demote any other primary assignments on this job
    await prisma.jobAssignment.updateMany({
      where: { jobId, technicianId: { not: technicianId }, role: "primary", status: { not: "Removed" } },
      data: { role: "assistant" },
    });

    await this.logStatusChange(jobId, job.status, updated.status, assignedBy, {
      assignedTechnicianId: technicianId,
      action: "assign_technician",
    });

    try {
      await MobilePushService.sendAppRequest({
        recipientId: technicianId,
        senderName: assignedBy,
        senderRole: "dispatcher",
        type: "JOB_DISPATCH",
        title: \`New Job Assigned: \${updated.jobNumber}\`,
        body: \`You have been assigned to \${updated.customer?.name || "Customer"} for \${updated.jobType}. Tap to review and accept.\`,
        priority: "high",
        actionRequired: true,
        payload: {
          jobId: updated.id,
          jobNumber: updated.jobNumber,
          customerName: updated.customer?.name,
          customerPhone: updated.customer?.phone,
          addressText: updated.customer?.addressText,
          lat: updated.customer?.lat,
          lng: updated.customer?.lng,
          jobType: updated.jobType,
          remarks: updated.remarks,
        },
      });
    } catch (e) {
      console.error("[JobsService] Failed to dispatch mobile push for job assignment:", e);
    }

    return updated;
  }`;

if (!s.includes("Mid-job technician change requires reassignment")) {
  if (!s.includes(oldAssign)) {
    console.error("old assignTechnician not found");
    process.exit(1);
  }
  s = s.replace(oldAssign, newAssign);
  console.log("assignTechnician updated");
} else {
  console.log("assignTechnician already patched");
}

// Replace acceptJob to check assignments and update them
const oldAccept = `  static async acceptJob(jobId: string, technicianId: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");
    if (job.status !== "Assigned") {
      throw new Error(\`Cannot accept job with status '\${job.status}'. Must be 'Assigned'.\`);
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: { status: "Accepted" },
    });

    await this.logStatusChange(jobId, "Assigned", "Accepted", technicianId);
    return updated;
  }`;

const newAccept = `  static async acceptJob(jobId: string, technicianId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { assignments: true },
    });
    if (!job) throw new Error("Job not found");
    if (job.status === "TechnicianReassigned") {
      throw new Error("This job was reassigned to another work order. Open the successor job instead.");
    }
    if (job.status !== "Assigned") {
      throw new Error(\`Cannot accept job with status '\${job.status}'. Must be 'Assigned'.\`);
    }

    const isPrimary = job.assignedTechnicianId === technicianId;
    const assignment = (job.assignments || []).find(
      (a) => a.technicianId === technicianId && a.status !== "Removed"
    );
    if (!isPrimary && !assignment) {
      throw new Error("You are not assigned to this job.");
    }

    // Primary accept moves job to Accepted; assistant accept only updates their assignment row
    let updated = job;
    if (isPrimary || assignment?.role === "primary" || !job.assignedTechnicianId) {
      updated = await prisma.job.update({
        where: { id: jobId },
        data: {
          status: "Accepted",
          assignedTechnicianId: job.assignedTechnicianId || technicianId,
        },
        include: { assignments: true, assignedTechnician: true, customer: true, items: true },
      });
      await this.logStatusChange(jobId, "Assigned", "Accepted", technicianId);
    } else {
      await this.logStatusChange(jobId, job.status, job.status, technicianId, {
        action: "assistant_accepted",
        technicianId,
      });
      updated = (await prisma.job.findUnique({
        where: { id: jobId },
        include: { assignments: true, assignedTechnician: true, customer: true, items: true },
      })) as any;
    }

    await prisma.jobAssignment.upsert({
      where: { jobId_technicianId: { jobId, technicianId } },
      create: {
        jobId,
        technicianId,
        role: isPrimary || assignment?.role === "primary" ? "primary" : "assistant",
        status: "Accepted",
        assignedBy: "self-accept",
        acceptedAt: new Date(),
      },
      update: {
        status: "Accepted",
        acceptedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Batch-accept multiple Assigned jobs for one technician (mobile multi-select).
   */
  static async acceptJobs(jobIds: string[], technicianId: string) {
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      throw new Error("jobIds required");
    }
    const results: { jobId: string; ok: boolean; error?: string; job?: any }[] = [];
    for (const jobId of jobIds) {
      try {
        const job = await this.acceptJob(jobId, technicianId);
        results.push({ jobId, ok: true, job });
      } catch (e: any) {
        results.push({ jobId, ok: false, error: e?.message || "Failed" });
      }
    }
    return {
      accepted: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  /**
   * Assign multiple technicians to one job. First id (or primaryTechnicianId) becomes primary
   * and is mirrored onto Job.assignedTechnicianId for backward compatibility.
   */
  static async assignTechnicians(
    jobId: string,
    technicianIds: string[],
    assignedBy: string,
    primaryTechnicianId?: string
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Job not found");
    if (job.finalizedAt) throw new Error("Job is finalized and locked.");
    if (job.status === "TechnicianReassigned") {
      throw new Error("Cannot assign technicians to a reassigned (closed) job.");
    }
    const ids = [...new Set((technicianIds || []).filter(Boolean))];
    if (ids.length === 0) throw new Error("At least one technicianId is required");

    const primaryId = primaryTechnicianId && ids.includes(primaryTechnicianId) ? primaryTechnicianId : ids[0];

    // Upsert all assignments
    for (const techId of ids) {
      await prisma.jobAssignment.upsert({
        where: { jobId_technicianId: { jobId, technicianId: techId } },
        create: {
          jobId,
          technicianId: techId,
          role: techId === primaryId ? "primary" : "assistant",
          status: "Assigned",
          assignedBy,
        },
        update: {
          role: techId === primaryId ? "primary" : "assistant",
          status: "Assigned",
          assignedBy,
          acceptedAt: null,
        },
      });
    }

    // Soft-remove assignments not in the new set
    await prisma.jobAssignment.updateMany({
      where: { jobId, technicianId: { notIn: ids }, status: { not: "Removed" } },
      data: { status: "Removed" },
    });

    const nextStatus =
      job.status === "Created" || job.status === "Assigned" ? "Assigned" : job.status;

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        assignedTechnicianId: primaryId,
        status: nextStatus,
      },
      include: {
        assignedTechnician: true,
        customer: true,
        assignments: { where: { status: { not: "Removed" } }, include: { technician: true } },
        items: true,
      },
    });

    await this.logStatusChange(jobId, job.status, updated.status, assignedBy, {
      action: "assign_technicians",
      technicianIds: ids,
      primaryTechnicianId: primaryId,
    });

    for (const techId of ids) {
      try {
        await MobilePushService.sendAppRequest({
          recipientId: techId,
          senderName: assignedBy,
          senderRole: "dispatcher",
          type: "JOB_DISPATCH",
          title: \`Job Assigned: \${updated.jobNumber}\`,
          body: \`You have been assigned (\${techId === primaryId ? "lead" : "assistant"}) to \${updated.customer?.name || "Customer"} — \${updated.jobType}.\`,
          priority: "high",
          actionRequired: true,
          payload: {
            jobId: updated.id,
            jobNumber: updated.jobNumber,
            customerName: updated.customer?.name,
            jobType: updated.jobType,
            role: techId === primaryId ? "primary" : "assistant",
          },
        });
      } catch (e) {
        console.error("[JobsService] multi-assign push failed:", e);
      }
    }

    return updated;
  }

  /**
   * Mid-job reassignment: do NOT overwrite the old job's technician.
   * Creates a NEW job copying relevant fields/items, assigns the new tech,
   * marks the OLD job TechnicianReassigned, and links via parentJobId / reassignedFromJobId.
   */
  static async reassignTechnician(
    jobId: string,
    newTechnicianId: string,
    assignedBy: string,
    opts?: { copyItems?: boolean; notes?: string }
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { items: true, customer: true, assignments: true },
    });
    if (!job) throw new Error("Job not found");
    if (job.finalizedAt) throw new Error("Job is finalized and locked.");
    if (job.status === "TechnicianReassigned") {
      throw new Error("Job was already reassigned. Use the successor job.");
    }
    if (["Finalized", "Verified"].includes(job.status)) {
      throw new Error(\`Cannot reassign a \${job.status} job.\`);
    }
    if (!newTechnicianId) throw new Error("newTechnicianId required");
    if (job.assignedTechnicianId === newTechnicianId) {
      throw new Error("New technician is already the primary assignee.");
    }

    const copyItems = opts?.copyItems !== false;
    const count = await prisma.job.count();
    const jobNumber = \`JOB-2026-\${String(count + 1).padStart(4, "0")}\`;

    const newJob = await prisma.\$transaction(async (tx) => {
      const created = await tx.job.create({
        data: {
          jobNumber,
          customerId: job.customerId,
          careOfPartyId: job.careOfPartyId,
          manualJobNumber: job.manualJobNumber,
          jobType: job.jobType,
          remarks: [
            job.remarks || "",
            \`Reassigned from \${job.jobNumber}\`,
            opts?.notes ? \`Note: \${opts.notes}\` : "",
          ]
            .filter(Boolean)
            .join(" | "),
          status: "Assigned",
          assignedTechnicianId: newTechnicianId,
          parentJobId: job.id,
          reassignedFromJobId: job.id,
          discountAmount: job.discountAmount || 0,
          discountReason: job.discountReason,
          ...(copyItems && job.items.length > 0
            ? {
                items: {
                  create: job.items.map((it) => ({
                    description: it.description,
                    quantityPlanned: it.quantityPlanned,
                    quantityActual: null,
                    unitRate: it.unitRate,
                  })),
                },
              }
            : {}),
          assignments: {
            create: {
              technicianId: newTechnicianId,
              role: "primary",
              status: "Assigned",
              assignedBy,
            },
          },
        },
        include: {
          customer: true,
          assignedTechnician: true,
          items: true,
          assignments: true,
        },
      });

      await tx.job.update({
        where: { id: job.id },
        data: { status: "TechnicianReassigned" },
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId: job.id,
          fromStatus: job.status,
          toStatus: "TechnicianReassigned",
          changedBy: assignedBy,
          metaJson: JSON.stringify({
            action: "technician_reassigned",
            previousTechnicianId: job.assignedTechnicianId,
            newTechnicianId,
            successorJobId: created.id,
            successorJobNumber: created.jobNumber,
            notes: opts?.notes || null,
          }),
        },
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId: created.id,
          fromStatus: "None",
          toStatus: "Assigned",
          changedBy: assignedBy,
          metaJson: JSON.stringify({
            action: "created_via_reassignment",
            parentJobId: job.id,
            parentJobNumber: job.jobNumber,
            newTechnicianId,
          }),
        },
      });

      return created;
    });

    try {
      await MobilePushService.sendAppRequest({
        recipientId: newTechnicianId,
        senderName: assignedBy,
        senderRole: "dispatcher",
        type: "JOB_DISPATCH",
        title: \`Reassigned Job: \${newJob.jobNumber}\`,
        body: \`You received work order \${newJob.jobNumber} (from \${job.jobNumber}) for \${newJob.customer?.name || "Customer"}. Tap to accept.\`,
        priority: "high",
        actionRequired: true,
        payload: {
          jobId: newJob.id,
          jobNumber: newJob.jobNumber,
          parentJobId: job.id,
          parentJobNumber: job.jobNumber,
          customerName: newJob.customer?.name,
          jobType: newJob.jobType,
          reassigned: true,
        },
      });
    } catch (e) {
      console.error("[JobsService] reassign push failed:", e);
    }

    // Notify previous tech that job moved
    if (job.assignedTechnicianId) {
      try {
        await MobilePushService.sendAppRequest({
          recipientId: job.assignedTechnicianId,
          senderName: assignedBy,
          senderRole: "dispatcher",
          type: "JOB_RESCHEDULED",
          title: \`Job \${job.jobNumber} reassigned\`,
          body: \`Work order \${job.jobNumber} was reassigned. Historical data is preserved; successor is \${newJob.jobNumber}.\`,
          priority: "normal",
          actionRequired: false,
          payload: {
            jobId: job.id,
            successorJobId: newJob.id,
            successorJobNumber: newJob.jobNumber,
          },
        });
      } catch (e) {
        console.error("[JobsService] prior-tech notify failed:", e);
      }
    }

    return {
      oldJob: await prisma.job.findUnique({
        where: { id: job.id },
        include: { assignedTechnician: true, statusHistory: { orderBy: { changedAt: "desc" }, take: 3 } },
      }),
      newJob,
    };
  }`;

if (!s.includes("static async reassignTechnician")) {
  if (!s.includes(oldAccept)) {
    console.error("old acceptJob not found");
    process.exit(1);
  }
  s = s.replace(oldAccept, newAccept);
  console.log("acceptJob + reassign + multi-assign + batch accept added");
} else {
  console.log("reassign already present");
}

fs.writeFileSync(path, s);
console.log("JobsService patched, lines:", s.split("\\n").length);
