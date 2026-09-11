"use client";

import React from "react";
import { useRouter } from "next/navigation";
import JobReportsView from "@/components/jobs/JobReportsView";

export default function JobReportsPage() {
  const router = useRouter();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <JobReportsView onBackToDirectory={() => router.push("/jobs")} />
    </div>
  );
}
