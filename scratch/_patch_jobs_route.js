const fs = require("fs");
const path = "src/app/api/jobs/route.ts";
let s = fs.readFileSync(path, "utf8");

const oldWhere = `    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (technicianId) where.assignedTechnicianId = technicianId;
    if (hasInventoryRequest) {
      where.inventoryRequests = { some: {} };
    }
    if (search) {
      where.OR = [
        { jobNumber: { contains: search } },
        { remarks: { contains: search } },
        { customer: { name: { contains: search } } },
      ];
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        customer: true,
        careOfParty: true,
        assignedTechnician: true,
        items: true,
        expenseClaims: true,
        inventoryRequests: true,
        stockReturns: true,
        statusHistory: {
          orderBy: { changedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(jobs);`;

const newWhere = `    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (technicianId) {
      // Include jobs where tech is primary assignee OR active JobAssignment member
      where.OR = [
        { assignedTechnicianId: technicianId },
        {
          assignments: {
            some: {
              technicianId,
              status: { not: "Removed" },
            },
          },
        },
      ];
    }
    if (hasInventoryRequest) {
      where.inventoryRequests = { some: {} };
    }
    if (search) {
      const searchClause = [
        { jobNumber: { contains: search } },
        { remarks: { contains: search } },
        { customer: { name: { contains: search } } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchClause }];
        delete where.OR;
      } else {
        where.OR = searchClause;
      }
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        customer: true,
        careOfParty: true,
        assignedTechnician: true,
        parentJob: { select: { id: true, jobNumber: true, status: true } },
        childJobs: { select: { id: true, jobNumber: true, status: true } },
        assignments: {
          where: { status: { not: "Removed" } },
          include: { technician: { select: { id: true, name: true, phone: true } } },
        },
        items: true,
        expenseClaims: true,
        inventoryRequests: true,
        stockReturns: true,
        statusHistory: {
          orderBy: { changedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(jobs);`;

if (!s.includes("assignments: {")) {
  if (!s.includes(oldWhere)) {
    console.error("GET where block not found");
    process.exit(1);
  }
  s = s.replace(oldWhere, newWhere);
  console.log("GET technician filter + assignments include updated");
}

// Add batch_accept to POST
const oldPostStart = `export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerId,
      careOfPartyId,
      manualJobNumber,
      jobType,
      remarks,
      items,
      assignedTechnicianId,
    } = body;`;

const newPostStart = `export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Batch accept (mobile): { action: "batch_accept", jobIds: [], technicianId }
    if (body.action === "batch_accept" || body.action === "accept_jobs") {
      const { jobIds, technicianId } = body;
      if (!technicianId) {
        return NextResponse.json({ error: "technicianId required" }, { status: 400 });
      }
      const result = await JobsService.acceptJobs(jobIds || [], technicianId);
      return NextResponse.json(result);
    }

    const {
      customerId,
      careOfPartyId,
      manualJobNumber,
      jobType,
      remarks,
      items,
      assignedTechnicianId,
      technicianIds,
    } = body;`;

if (!s.includes("batch_accept")) {
  if (!s.includes(oldPostStart)) {
    console.error("POST start not found");
    process.exit(1);
  }
  s = s.replace(oldPostStart, newPostStart);
  console.log("POST batch_accept added");
}

// After create with assignedTechnicianId, also create assignment(s)
const oldNotify = `    if (assignedTechnicianId) {
      await JobsService.notifyJobAssignedIfNeeded(job, "Dispatcher");
    }

    return NextResponse.json(job, { status: 201 });`;

const newNotify = `    const multiIds: string[] = Array.isArray(technicianIds)
      ? technicianIds.filter(Boolean)
      : assignedTechnicianId
        ? [assignedTechnicianId]
        : [];

    if (multiIds.length > 0) {
      try {
        await JobsService.assignTechnicians(
          job.id,
          multiIds,
          "Dispatcher",
          assignedTechnicianId || multiIds[0]
        );
      } catch (e) {
        console.error("Failed to sync JobAssignment on create:", e);
        if (assignedTechnicianId) {
          await JobsService.notifyJobAssignedIfNeeded(job, "Dispatcher");
        }
      }
    }

    const fresh = await prisma.job.findUnique({
      where: { id: job.id },
      include: {
        customer: true,
        items: true,
        assignedTechnician: true,
        assignments: { where: { status: { not: "Removed" } }, include: { technician: true } },
      },
    });

    return NextResponse.json(fresh || job, { status: 201 });`;

if (!s.includes("sync JobAssignment on create")) {
  if (!s.includes(oldNotify)) {
    console.error("notify block not found");
    process.exit(1);
  }
  s = s.replace(oldNotify, newNotify);
  console.log("POST create multi-tech sync added");
}

fs.writeFileSync(path, s);
console.log("jobs/route.ts patched");
