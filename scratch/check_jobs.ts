import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      jobNumber: true,
      jobType: true,
      remarks: true,
    },
  });
  console.log("Jobs found:", jobs.length);
  for (const j of jobs) {
    console.log(`[${j.jobNumber}] jobType: "${j.jobType}"`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
