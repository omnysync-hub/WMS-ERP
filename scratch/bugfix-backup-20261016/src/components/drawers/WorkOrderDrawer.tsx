"use client";

import React from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { FileText, Printer } from "lucide-react";
import WorkOrderDocument from "@/components/documents/WorkOrderDocument";
import { printDocument } from "@/lib/printUtils";

interface WorkOrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
}

export default function WorkOrderDrawer({
  isOpen,
  onClose,
  job,
}: WorkOrderDrawerProps) {
  if (!job) return null;

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-4xl"
      title={
        <span className="inline-flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#0D7A5F]" />
          Field Work Order · Technical Document
        </span>
      }
      subtitle={`Work Order #${job?.jobNumber || "—"} · Printable Format`}
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5] transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => printDocument("#printable-work-order", `Work_Order_${job.jobNumber}`)}
            className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0B6851] text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </button>
        </div>
      }
    >
      <WorkOrderDocument job={job} onClose={onClose} />
    </SideDrawer>
  );
}
