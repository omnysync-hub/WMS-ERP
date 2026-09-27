const fs = require("fs");
const root = "D:/WMS-APP 1/workman-mobile";

const path = root + "/types/index.ts";
let s = fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
const oldJob = `export type Job = {
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
};`;
const newJob = `export type JobAssignment = {
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
};`;
if (!s.includes("JobAssignment")) {
  if (!s.includes(oldJob)) { console.error("old Job not found"); process.exit(1); }
  s = s.replace(oldJob, newJob);
  console.log("types Job updated");
}
if (!s.includes("TechnicianReassigned")) {
  s = s.replace('| "Cancelled"\n  | string;', '| "Cancelled"\n  | "TechnicianReassigned"\n  | string;');
}
fs.writeFileSync(path, s);

const apiPath = root + "/services/api.ts";
let api = fs.readFileSync(apiPath, "utf8").replace(/^\uFEFF/, "");
if (!api.includes("batchAcceptJobs:")) {
  const marker = "offlineQueue: true,\n    }),\n\n  claimJobExpense:";
  const alt = "offlineQueue: true,\n    }),\r\n\r\n  claimJobExpense:";
  if (api.includes(marker)) {
    api = api.replace(
      marker,
      `offlineQueue: true,
    }),

  batchAcceptJobs: (data: { jobIds: string[]; technicianId: string }) =>
    apiRequest({
      method: "POST",
      url: "/api/jobs",
      data: { action: "batch_accept", ...data },
      offlineQueue: true,
    }),

  claimJobExpense:`
    );
    console.log("api patched via marker");
  } else if (api.includes(alt)) {
    api = api.replace(
      alt,
      `offlineQueue: true,\r\n    }),\r\n\r\n  batchAcceptJobs: (data: { jobIds: string[]; technicianId: string }) =>\r\n    apiRequest({\r\n      method: "POST",\r\n      url: "/api/jobs",\r\n      data: { action: "batch_accept", ...data },\r\n      offlineQueue: true,\r\n    }),\r\n\r\n  claimJobExpense:`
    );
    console.log("api patched via alt CRLF");
  } else {
    const idx = api.indexOf("claimJobExpense");
    console.log("claimJobExpense idx", idx, JSON.stringify(api.slice(idx - 120, idx)));
    process.exit(1);
  }
  fs.writeFileSync(apiPath, api);
} else console.log("api already has batchAcceptJobs");

const jsPath = root + "/services/jobsService.ts";
let js = fs.readFileSync(jsPath, "utf8").replace(/^\uFEFF/, "");
js = js.replace(
  /(job\.assignments \|\| \[\])\.some\(\s*\(a\) =>/,
  "$1.some(\n    (a: { technicianId: string; status?: string }) =>"
);
fs.writeFileSync(jsPath, js);
console.log("done");
