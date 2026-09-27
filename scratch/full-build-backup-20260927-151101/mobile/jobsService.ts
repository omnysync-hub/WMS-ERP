import { api } from "@/services/api";
import { cacheJob } from "@/services/syncService";
import type { Job } from "@/types";

export async function fetchJobs(technicianId: string, status?: string) {
  const { data } = await api.getJobs(technicianId, status);
  const jobs: Job[] = Array.isArray(data) ? data : data?.jobs ?? data?.data ?? [];
  for (const job of jobs) {
    await cacheJob({
      id: job.id,
      jobNumber: job.jobNumber,
      status: job.status,
      customerJson: JSON.stringify(job.customer ?? { name: job.customerName }),
      itemsJson: JSON.stringify(job.items ?? []),
    });
  }
  return jobs;
}

export async function fetchJob(jobId: string) {
  const { data } = await api.getJob(jobId);
  return (data?.job ?? data) as Job;
}

export async function transitionJob(
  jobId: string,
  payload: Record<string, unknown>
) {
  return api.updateJobStatus(jobId, payload);
}

export async function requestJobInventory(
  jobId: string,
  input: { technicianId: string; item: string; qtyRequested: number }
) {
  return api.requestJobInventory(jobId, input);
}

export async function returnJobStock(
  jobId: string,
  input: { technicianId: string; item: string; qtyReturned: number }
) {
  return api.returnJobStock(jobId, input);
}

export async function fetchWarehouseProducts() {
  const { data } = await api.getInventoryProducts();
  const list = Array.isArray(data) ? data : data?.products ?? [];
  return list as Array<{
    id: string;
    name: string;
    sku?: string;
    stockQuantity?: number;
    unit?: string;
  }>;
}
