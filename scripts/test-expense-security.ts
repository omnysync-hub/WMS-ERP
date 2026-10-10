import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { POST as createExpense } from "../src/app/api/jobs/[id]/expense/route";
import { signMobileToken } from "../src/lib/auth/mobileAuth";
import { prisma } from "../src/lib/prisma";

async function main() {
  const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const assignedSession = crypto.randomUUID();
  const otherSession = crypto.randomUUID();
  let customerId: string | undefined;
  let jobId: string | undefined;
  const employeeIds: string[] = [];

  try {
    const customer = await prisma.customer.create({
      data: {
        name: `Expense test ${runId}`,
        phone: `expense-${runId}`,
        addressText: "Automated test address",
      },
    });
    customerId = customer.id;

    const [assigned, other] = await Promise.all([
      prisma.employee.create({
        data: {
          name: `Assigned expense tech ${runId}`,
          phone: `assigned-${runId}`,
          role: "technician",
          department: "Field Operations",
          mobileLoginActive: true,
          mobileDeviceId: `device-assigned-${runId}`,
          mobileSessionId: assignedSession,
        },
      }),
      prisma.employee.create({
        data: {
          name: `Other expense tech ${runId}`,
          phone: `other-${runId}`,
          role: "technician",
          department: "Field Operations",
          mobileLoginActive: true,
          mobileDeviceId: `device-other-${runId}`,
          mobileSessionId: otherSession,
        },
      }),
    ]);
    employeeIds.push(assigned.id, other.id);

    const job = await prisma.job.create({
      data: {
        jobNumber: `EXP-${runId}`,
        customerId: customer.id,
        jobType: "repair",
        status: "Accepted",
        assignedTechnicianId: assigned.id,
      },
    });
    jobId = job.id;

    const call = (employeeId: string, sessionId: string, amount: number) =>
      createExpense(
        new NextRequest(`http://localhost/api/jobs/${job.id}/expense`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${signMobileToken(employeeId, Date.now(), sessionId)}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ amount, note: "[Fuel] automated test" }),
        }),
        { params: Promise.resolve({ id: job.id }) }
      );

    const valid = await call(assigned.id, assignedSession, 0.29);
    if (valid.status !== 201) {
      throw new Error(`Expected 0.29 to be accepted, got ${valid.status}: ${await valid.text()}`);
    }

    const tooPrecise = await call(assigned.id, assignedSession, 1.234);
    if (tooPrecise.status !== 400) {
      throw new Error(`Expected 1.234 to be rejected, got ${tooPrecise.status}`);
    }

    const unassigned = await call(other.id, otherSession, 10);
    if (unassigned.status !== 403) {
      throw new Error(`Expected unassigned technician to be rejected, got ${unassigned.status}`);
    }

    console.log("expense validation and assignment security checks ok");
  } finally {
    if (jobId) {
      await prisma.jobExpenseClaim.deleteMany({ where: { jobId } });
      await prisma.job.deleteMany({ where: { id: jobId } });
    }
    if (customerId) {
      await prisma.customer.deleteMany({ where: { id: customerId } });
    }
    if (employeeIds.length) {
      await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
