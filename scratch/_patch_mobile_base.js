const fs = require("fs");
const root = "D:/WMS-APP 1/workman-mobile";

// types
{
  const path = root + "/types/index.ts";
  let s = fs.readFileSync(path, "utf8");
  if (!s.includes("TechnicianReassigned")) {
    s = s.replace(
      '| "Cancelled"\n  | string;',
      '| "Cancelled"\n  | "TechnicianReassigned"\n  | string;'
    );
  }
  if (!s.includes("JobAssignment")) {
    s = s.replace(
      `export type Job = {
  id: string;
  jobNumber: string;
  status: JobStatus;
  priority?: string;
  scheduledAt?: string | null;
  customerName?: string;
  customerPhone?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
  items?: JobItem[];
  customer?: {
    name?: string;
    phone?: string;
    address?: string;
  };
};`,
      `export type JobAssignment = {
  id: string;
  jobId: string;
  technicianId: string;
  role?: "primary" | "assistant" | string;
  status?: string;
  technician?: { id: string; name?: string; phone?: string | null };
};

export type Job = {
  id: string;
  jobNumber: string;
  status: JobStatus;
  priority?: string;
  scheduledAt?: string | null;
  customerName?: string;
  customerPhone?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
  remarks?: string | null;
  items?: JobItem[];
  assignedTechnicianId?: string | null;
  parentJobId?: string | null;
  reassignedFromJobId?: string | null;
  parentJob?: { id: string; jobNumber: string; status?: string } | null;
  childJobs?: { id: string; jobNumber: string; status?: string }[];
  assignments?: JobAssignment[];
  customer?: {
    name?: string;
    phone?: string;
    address?: string;
  };
};`
    );
    console.log("types updated");
  }
  fs.writeFileSync(path, s);
}

// api.ts batch accept
{
  const path = root + "/services/api.ts";
  let s = fs.readFileSync(path, "utf8");
  if (!s.includes("batchAcceptJobs")) {
    s = s.replace(
      `  updateJobStatus: (jobId: string, payload: Record<string, unknown>) =>
    apiRequest({
      method: "PATCH",
      url: \`/api/jobs/\${jobId}\`,
      data: payload,
      offlineQueue: true,
    }),`,
      `  updateJobStatus: (jobId: string, payload: Record<string, unknown>) =>
    apiRequest({
      method: "PATCH",
      url: \`/api/jobs/\${jobId}\`,
      data: payload,
      offlineQueue: true,
    }),

  batchAcceptJobs: (data: { jobIds: string[]; technicianId: string }) =>
    apiRequest({
      method: "POST",
      url: "/api/jobs",
      data: { action: "batch_accept", ...data },
      offlineQueue: true,
    }),`
    );
    console.log("api.batchAcceptJobs added");
  }
  fs.writeFileSync(path, s);
}

// jobsService
{
  const path = root + "/services/jobsService.ts";
  let s = fs.readFileSync(path, "utf8");
  if (!s.includes("batchAcceptJobs")) {
    s += `

export async function batchAcceptJobs(jobIds: string[], technicianId: string) {
  return api.batchAcceptJobs({ jobIds, technicianId });
}

export function isJobVisibleToTechnician(job: Job, technicianId: string) {
  if (job.status === "TechnicianReassigned") return false;
  if (job.assignedTechnicianId === technicianId) return true;
  return (job.assignments || []).some(
    (a) => a.technicianId === technicianId && a.status !== "Removed"
  );
}
`;
    console.log("jobsService batch + visibility helpers");
  }
  fs.writeFileSync(path, s);
}
