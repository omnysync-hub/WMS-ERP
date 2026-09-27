const fs = require("fs");
const root = "D:/WMS-APP 1/workman-mobile";

function patchTypes() {
  const path = root + "/types/index.ts";
  let s = fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const had = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  if (s.includes("export type JobAssignment")) {
    console.log("types already patched");
  } else {
    const start = s.indexOf("export type Job = {");
    const end = s.indexOf("export type DispatchRequest", start);
    if (start < 0 || end < 0) throw new Error("Job block bounds not found");
    const replacement = `export type JobAssignment = {
  id: string;
  jobId?: string;
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
};

`;
    s = s.slice(0, start) + replacement + s.slice(end);
    console.log("types Job replaced");
  }
  if (!s.includes("TechnicianReassigned")) {
    s = s.replace('| "Cancelled"\n  | string;', '| "Cancelled"\n  | "TechnicianReassigned"\n  | string;');
  }
  if (had) s = s.replace(/\n/g, "\r\n");
  fs.writeFileSync(path, s);
}

function patchApi() {
  const path = root + "/services/api.ts";
  let s = fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const had = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  if (s.includes("batchAcceptJobs:")) {
    console.log("api already has batchAcceptJobs");
  } else {
    const key = "claimJobExpense:";
    const idx = s.indexOf(key);
    if (idx < 0) throw new Error("claimJobExpense not found");
    const insert = `batchAcceptJobs: (data: { jobIds: string[]; technicianId: string }) =>
    apiRequest({
      method: "POST",
      url: "/api/jobs",
      data: { action: "batch_accept", ...data },
      offlineQueue: true,
    }),

  `;
    s = s.slice(0, idx) + insert + s.slice(idx);
    console.log("api batchAcceptJobs inserted");
  }
  if (had) s = s.replace(/\n/g, "\r\n");
  fs.writeFileSync(path, s);
}

function patchJobsService() {
  const path = root + "/services/jobsService.ts";
  let s = fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const had = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  s = s.replace(
    "(a) => a.technicianId === technicianId && a.status !== \"Removed\"",
    "(a: { technicianId: string; status?: string }) => a.technicianId === technicianId && a.status !== \"Removed\""
  );
  if (had) s = s.replace(/\n/g, "\r\n");
  fs.writeFileSync(path, s);
  console.log("jobsService typed");
}

patchTypes();
patchApi();
patchJobsService();