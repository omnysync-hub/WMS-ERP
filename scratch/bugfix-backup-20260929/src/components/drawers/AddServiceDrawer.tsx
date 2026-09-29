"use client";

import React, { useEffect, useMemo, useState } from "react";
import SideDrawer from "@/components/ui/SideDrawer";
import { Plus, Trash2, Wrench, Check, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ServiceEntry {
  id: string;
  catalogServiceId: string;
  description: string;
  quantity: string;
  unitRate: string;
}

interface AddServiceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  actor: string;
  onSuccess?: () => void;
}

function createEmptyRow(): ServiceEntry {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    catalogServiceId: "",
    description: "",
    quantity: "1",
    unitRate: "",
  };
}

export default function AddServiceDrawer({
  isOpen,
  onClose,
  job,
  actor,
  onSuccess,
}: AddServiceDrawerProps) {
  const [catalogServices, setCatalogServices] = useState<any[]>([]);
  const [serviceRows, setServiceRows] = useState<ServiceEntry[]>([createEmptyRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg("");
    setServiceRows([createEmptyRow()]);

    fetch("/api/inventory")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const services = data.filter(
            (p: any) =>
              p.isService ||
              (p.sku && (p.sku.startsWith("SRV-") || p.sku.startsWith("SVC-"))) ||
              ["service", "visit", "job", "hr", "hour"].includes((p.unit || "").toLowerCase())
          );
          setCatalogServices(services);
        }
      })
      .catch((err) => {
        console.error("Failed to load catalog services", err);
      });
  }, [isOpen]);

  const addRow = () => {
    setServiceRows((prev) => [...prev, createEmptyRow()]);
  };

  const removeRow = (id: string) => {
    if (serviceRows.length <= 1) return;
    setServiceRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, patch: Partial<ServiceEntry>) => {
    setServiceRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return { ...r, ...patch };
      })
    );
  };

  const handleSelectCatalog = (id: string, catalogId: string) => {
    const srv = catalogServices.find((s) => s.id === catalogId);
    if (srv) {
      updateRow(id, {
        catalogServiceId: catalogId,
        description: srv.name,
        unitRate: String(srv.unitPrice || 0),
      });
    } else {
      updateRow(id, { catalogServiceId: "" });
    }
  };

  const grandTotal = useMemo(() => {
    return serviceRows.reduce((sum, r) => {
      const q = Number(r.quantity) || 0;
      const rate = Number(r.unitRate) || 0;
      return sum + q * rate;
    }, 0);
  }, [serviceRows]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    for (let i = 0; i < serviceRows.length; i++) {
      const row = serviceRows[i];
      if (!row.description.trim()) {
        setErrorMsg(`Please enter a description for Service #${i + 1}.`);
        return;
      }
      if (!Number(row.quantity) || Number(row.quantity) <= 0) {
        setErrorMsg(`Please enter a valid quantity greater than 0 for Service #${i + 1}.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const payloadServices = serviceRows.map((r) => ({
        description: r.description.trim(),
        quantity: Number(r.quantity),
        unitRate: Number(r.unitRate || 0),
      }));

      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_service",
          services: payloadServices,
          actor: actor,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add services");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add service items.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-xl"
      title={
        <span className="inline-flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-600" />
          Add Billable Services / Items
        </span>
      }
      subtitle={`Work Order #${job?.jobNumber || "—"} · ${job?.customer?.name || "Customer"}`}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div>
            <span className="text-[11px] text-[#71717A] block">
              {serviceRows.length} item{serviceRows.length === 1 ? "" : "s"} · Total:
            </span>
            <strong className="font-mono text-sm font-bold text-emerald-800">
              {formatCurrency(grandTotal)}
            </strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs text-[#71717A] hover:text-[#18181B] font-medium rounded-lg hover:bg-[#F4F4F5] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#0D7A5F] hover:bg-[#0A624C] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              {isSubmitting
                ? "Adding..."
                : serviceRows.length > 1
                ? `Add All (${serviceRows.length}) to Order`
                : "Add to Job Order"}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-[#71717A]">
            Add one or multiple billable services/materials to this job record at once:
          </p>
          <button
            type="button"
            onClick={addRow}
            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#0D7A5F] border border-emerald-200 font-bold rounded-lg text-xs inline-flex items-center gap-1 transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Another Item
          </button>
        </div>

        {/* Dynamic Multi-Service Line Items */}
        <div className="space-y-3.5">
          {serviceRows.map((row, idx) => {
            const rowSubtotal = (Number(row.quantity) || 0) * (Number(row.unitRate) || 0);

            return (
              <div
                key={row.id}
                className="p-3.5 bg-white border border-[#E4E4E7] rounded-xl space-y-3 shadow-2xs relative"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-[#F4F4F5]">
                  <span className="font-bold text-[#18181B] text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#0D7A5F] flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    Service / Line Item #{idx + 1}
                  </span>
                  {serviceRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="p-1 rounded text-[#71717A] hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {catalogServices.length > 0 && (
                  <div>
                    <label className="font-semibold text-purple-900 block mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1 font-bold text-[11px]">
                        <Wrench className="w-3 h-3 text-purple-700" />
                        Choose Predefined Service (Catalog)
                      </span>
                      <span className="text-[10px] text-purple-700 font-normal">Auto-fills description & rate</span>
                    </label>
                    <select
                      value={row.catalogServiceId}
                      onChange={(e) => handleSelectCatalog(row.id, e.target.value)}
                      className="w-full bg-purple-50/70 p-2 rounded-lg border border-purple-200 font-medium text-xs focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none text-[#18181B]"
                    >
                      <option value="">-- Choose from Catalog or type custom below --</option>
                      {catalogServices.map((srv) => (
                        <option key={srv.id} value={srv.id}>
                          {srv.name} ({srv.sku}) — {formatCurrency(srv.unitPrice)} / {srv.unit || "service"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="font-semibold text-[#18181B] block mb-1">
                    Service / Item Description *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Master Coil Chemical Servicing / Vacuum Testing"
                    value={row.description}
                    onChange={(e) => updateRow(row.id, { description: e.target.value })}
                    className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#D4D4D8] font-medium text-xs focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-[1fr_1fr_auto] gap-2.5 items-end">
                  <div>
                    <label className="font-semibold text-[#18181B] block mb-1">
                      Qty *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={row.quantity}
                      onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                      className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#D4D4D8] font-mono font-bold text-xs focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[#18181B] block mb-1">
                      Unit Rate (PKR) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      placeholder="e.g. 3500"
                      value={row.unitRate}
                      onChange={(e) => updateRow(row.id, { unitRate: e.target.value })}
                      className="w-full bg-[#F4F4F5] p-2 rounded-lg border border-[#D4D4D8] font-mono font-bold text-xs focus:bg-white focus:ring-2 focus:ring-[#0D7A5F] focus:outline-none"
                    />
                  </div>
                  <div className="text-right pb-1">
                    <span className="text-[10px] text-[#71717A] block">Subtotal</span>
                    <span className="font-mono font-bold text-emerald-800 text-xs">
                      {formatCurrency(rowSubtotal)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="w-full py-2.5 bg-[#FAFAFA] hover:bg-emerald-50 text-[#0D7A5F] border border-dashed border-[#D4D4D8] hover:border-emerald-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
        >
          <Plus className="w-4 h-4" />
          Add Another Service Line Item
        </button>

        <div className="p-3 bg-emerald-50 rounded-lg text-[11px] text-emerald-950 space-y-1 border border-emerald-200 leading-relaxed">
          <p>• Added service items will be immediately incorporated into actual billing & revenue.</p>
          <p>• Line items marked as added by {actor} in audit trail.</p>
        </div>
      </form>
    </SideDrawer>
  );
}
