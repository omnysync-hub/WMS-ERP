"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import JobReportsView from "@/components/jobs/JobReportsView";
import { useRole } from "@/contexts/RoleContext";
import { Lock } from "lucide-react";

export default function JobReportsPage() {
  const router = useRouter();
  const { activeRole, hasPermission } = useRole();
  const isStorekeeper = activeRole === "storekeeper";
  const canViewReports = hasPermission("jobs.reports") && !isStorekeeper;

  useEffect(() => {
    if (isStorekeeper) {
      router.replace("/jobs");
    }
  }, [isStorekeeper, router]);

  if (isStorekeeper || !canViewReports) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[#18181B]">
          Daily Audit & Reports Access Restricted
        </h3>
        <p className="text-xs text-[#71717A]">
          Storekeeper accounts are restricted to material fulfillment queues and stock issuance. Daily audit and financial reports are strictly inaccessible.
        </p>
        <button
          type="button"
          onClick={() => router.push("/jobs")}
          className="px-4 py-2 bg-[#0D7A5F] text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
        >
          Return to Work Orders
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <JobReportsView onBackToDirectory={() => router.push("/jobs")} />
    </div>
  );
}
