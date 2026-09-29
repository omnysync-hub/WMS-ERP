import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function formatJobType(type: string | null | undefined): string {
  if (!type) return "General Service";
  
  let formatted = type
    .replace(/___/g, " & ")
    .replace(/__/g, " - ")
    .replace(/_+/g, " ")
    .trim();

  const acronyms: Record<string, string> = {
    ac: "AC",
    amc: "(AMC)",
    ahu: "AHU",
    fcu: "FCU",
    vrf: "VRF",
    gps: "GPS",
    hvac: "HVAC",
  };

  return formatted
    .split(/\s+/)
    .map((w) => {
      const lower = w.toLowerCase().replace(/[^a-z]/g, "");
      if (lower === "repa") return "Repair";
      if (acronyms[lower]) {
        return acronyms[lower];
      }
      if (w === "&" || w === "-") return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

async function main() {
  const jobs = await prisma.job.findMany();
  console.log("Checking", jobs.length, "jobs...");
  let updatedCount = 0;

  for (const job of jobs) {
    if (job.jobType && (job.jobType.includes("_") || job.jobType.includes("repa"))) {
      const cleanType = formatJobType(job.jobType);
      console.log(`Updating ${job.jobNumber}: "${job.jobType}" -> "${cleanType}"`);
      await prisma.job.update({
        where: { id: job.id },
        data: { jobType: cleanType },
      });
      updatedCount++;
    }
  }

  console.log(`Done! Updated ${updatedCount} jobs.`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
