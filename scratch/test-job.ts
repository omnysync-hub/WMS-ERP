import { prisma } from "../src/lib/prisma";

async function testJob() {
  try {
    const count = await prisma.job.count();
    console.log("Job count:", count);
  } catch (err) {
    console.error("Job table error:", err);
  }
}

testJob().catch(console.error).finally(() => process.exit(0));
