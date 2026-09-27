const fs = require("fs");
const path = "prisma/schema.prisma";
let s = fs.readFileSync(path, "utf8");

const oldStatusLine =
  '  status               String              @default("Created") // Created, Assigned, Accepted, InProgress, Paused, CompletedPendingVerification, Finalized, Verified';
const newStatusLine =
  '  status               String              @default("Created") // Created, Assigned, Accepted, InProgress, Paused, CompletedPendingVerification, Finalized, Verified, TechnicianReassigned';

if (!s.includes(oldStatusLine)) {
  if (s.includes("TechnicianReassigned")) {
    console.log("status already updated");
  } else {
    console.error("status line not found");
    process.exit(1);
  }
} else {
  s = s.replace(oldStatusLine, newStatusLine);
  console.log("status comment updated");
}

const insertAfter = `  assignedTechnicianId String?
  assignedTechnician   Employee?           @relation(fields: [assignedTechnicianId], references: [id])
  discountAmount`;

const insertWith = `  assignedTechnicianId String?
  assignedTechnician   Employee?           @relation(fields: [assignedTechnicianId], references: [id])
  /// Mid-job reassignment: new job sets parentJobId / reassignedFromJobId; old job status -> TechnicianReassigned
  parentJobId          String?
  parentJob            Job?                @relation("JobReassignmentTree", fields: [parentJobId], references: [id])
  childJobs            Job[]               @relation("JobReassignmentTree")
  reassignedFromJobId  String?
  discountAmount`;

if (s.includes("parentJobId")) {
  console.log("parentJobId already present");
} else if (!s.includes(insertAfter)) {
  console.error("insertAfter not found");
  process.exit(1);
} else {
  s = s.replace(insertAfter, insertWith);
  console.log("parentJob fields added");
}

if (!s.includes("assignments          JobAssignment[]")) {
  const relAnchor = `  feedbackCalls        FeedbackCall[]
  locationPings        TechnicianLocationPing[]
}`;
  const relWith = `  feedbackCalls        FeedbackCall[]
  locationPings        TechnicianLocationPing[]
  assignments          JobAssignment[]
}`;
  if (!s.includes(relAnchor)) {
    console.error("Job relations anchor not found");
    process.exit(1);
  }
  s = s.replace(relAnchor, relWith);
  console.log("assignments relation added");
}

const jobAssignmentModel = `
model JobAssignment {
  id           String    @id @default(uuid())
  jobId        String
  job          Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)
  technicianId String
  technician   Employee  @relation(fields: [technicianId], references: [id])
  role         String    @default("primary") // primary, assistant
  status       String    @default("Assigned") // Assigned, Accepted, Declined, Removed
  assignedAt   DateTime  @default(now())
  assignedBy   String?
  acceptedAt   DateTime?
  notes        String?

  @@unique([jobId, technicianId])
  @@index([technicianId])
  @@index([jobId])
}

`;

if (s.includes("model JobAssignment")) {
  console.log("JobAssignment already exists");
} else {
  const invIdx = s.indexOf("model InventoryRequest {");
  if (invIdx < 0) {
    console.error("InventoryRequest not found");
    process.exit(1);
  }
  s = s.slice(0, invIdx) + jobAssignmentModel + s.slice(invIdx);
  console.log("Inserted JobAssignment");
}

if (!s.includes("jobAssignments")) {
  const empAnchor = "  jobs                 Job[]\n  attendanceLogs       AttendanceLog[]";
  if (!s.includes(empAnchor)) {
    console.error("Employee jobs anchor not found");
    process.exit(1);
  }
  s = s.replace(
    empAnchor,
    "  jobs                 Job[]\n  jobAssignments       JobAssignment[]\n  attendanceLogs       AttendanceLog[]"
  );
  console.log("Added Employee.jobAssignments");
}

fs.writeFileSync(path, s);
console.log("schema.prisma patched OK");
