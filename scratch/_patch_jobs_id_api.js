const fs = require("fs");
const path = "src/app/api/jobs/[id]/route.ts";
let s = fs.readFileSync(path, "utf8");

// Enrich GET includes
const oldInclude = `      include: {
        customer: true,
        careOfParty: true,
        assignedTechnician: true,
        items: true,
        statusHistory: {
          orderBy: { changedAt: "desc" },
        },
        inventoryRequests: {
          orderBy: { createdAt: "desc" },
        },
        stockReturns: {
          orderBy: { createdAt: "desc" },
        },
        expenseClaims: {
          orderBy: { createdAt: "desc" },
        },
        hisaabSettlements: {
          orderBy: { settledAt: "desc" },
        },
        feedbackCalls: {
          orderBy: { calledAt: "desc" },
        },
      },`;

const newInclude = `      include: {
        customer: true,
        careOfParty: true,
        assignedTechnician: true,
        parentJob: { select: { id: true, jobNumber: true, status: true } },
        childJobs: { select: { id: true, jobNumber: true, status: true, assignedTechnicianId: true } },
        assignments: {
          where: { status: { not: "Removed" } },
          include: { technician: { select: { id: true, name: true, phone: true, currentStatus: true } } },
        },
        items: true,
        statusHistory: {
          orderBy: { changedAt: "desc" },
        },
        inventoryRequests: {
          orderBy: { createdAt: "desc" },
        },
        stockReturns: {
          orderBy: { createdAt: "desc" },
        },
        expenseClaims: {
          orderBy: { createdAt: "desc" },
        },
        hisaabSettlements: {
          orderBy: { settledAt: "desc" },
        },
        feedbackCalls: {
          orderBy: { calledAt: "desc" },
        },
      },`;

if (!s.includes("assignments:")) {
  if (!s.includes(oldInclude)) {
    console.error("GET include not found");
    process.exit(1);
  }
  s = s.replace(oldInclude, newInclude);
  console.log("GET include enriched");
}

const oldAssignCase = `      case "assign":
        result = await JobsService.assignTechnician(
          params.id,
          payload.technicianId,
          actor
        );
        break;

      case "accept":
        result = await JobsService.acceptJob(params.id, actor);
        break;`;

const newAssignCase = `      case "assign":
        // Single primary assign (Created/Assigned only). Mid-job changes must use "reassign".
        result = await JobsService.assignTechnician(
          params.id,
          payload.technicianId,
          actor
        );
        break;

      case "assign_technicians":
      case "assign_multiple": {
        const ids = payload.technicianIds || payload.technicians || [];
        result = await JobsService.assignTechnicians(
          params.id,
          ids,
          actor,
          payload.primaryTechnicianId || payload.primaryId
        );
        break;
      }

      case "reassign": {
        result = await JobsService.reassignTechnician(
          params.id,
          payload.technicianId || payload.newTechnicianId,
          actor,
          {
            copyItems: payload.copyItems !== false,
            notes: payload.notes || payload.reason,
          }
        );
        break;
      }

      case "accept":
        result = await JobsService.acceptJob(
          params.id,
          payload.technicianId || actor
        );
        break;`;

if (!s.includes('case "reassign"')) {
  if (!s.includes(oldAssignCase)) {
    console.error("assign/accept case block not found");
    process.exit(1);
  }
  s = s.replace(oldAssignCase, newAssignCase);
  console.log("PATCH actions reassign/assign_technicians added");
}

fs.writeFileSync(path, s);
console.log("jobs/[id]/route.ts patched");
