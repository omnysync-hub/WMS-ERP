"use client";

import React, { useState } from "react";
import {
  FileText,
  Plus,
  Check,
  X,
  PenLine,
  ExternalLink,
  Truck,
  ClipboardList,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useRole } from "@/contexts/RoleContext";

export interface ProjectDocument {
  id: string;
  kind: string; // drawing | wcc | mir | other
  title: string;
  url?: string | null;
  notes?: string | null;
  status?: string | null;
  signedByName?: string | null;
  signedAt?: string | null;
  uploadedBy?: string | null;
  createdAt?: string;
}

export interface ProjectDeliveryOrder {
  id: string;
  doNumber?: string | null;
  items: Array<{ description: string; qty: number; unit: string }>;
  status?: string | null;
  notes?: string | null;
  createdAt?: string;
}

interface ProjectDocumentsTabProps {
  projectId: string;
  documents: ProjectDocument[];
  deliveryOrders: ProjectDeliveryOrder[];
  onRefresh: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

const KIND_META: Record<string, { label: string; cls: string }> = {
  drawing: { label: "Drawing", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  wcc: { label: "WCC", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  mir: { label: "MIR", cls: "bg-purple-50 text-purple-700 border-purple-200" },
  other: { label: "Other", cls: "bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]" },
};

const selectCls =
  "h-8 px-2 text-xs bg-white border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] text-[#18181B]";
const inputCls =
  "h-8 px-2.5 text-xs bg-white border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] text-[#18181B] w-full";
const btnPrimary =
  "h-8 px-3 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50";
const btnGhost =
  "h-7 px-2 rounded-lg border border-[#D4D4D8] bg-white hover:bg-[#F4F4F5] text-[11px] font-semibold text-[#52525B] inline-flex items-center gap-1 transition disabled:opacity-50";

export default function ProjectDocumentsTab({
  projectId,
  documents,
  deliveryOrders,
  onRefresh,
  showToast,
}: ProjectDocumentsTabProps) {
  const { hasPermission } = useRole();
  const canApproveDocs = hasPermission("projects.documents_approve");
  const canCreateDo = hasPermission("projects.delivery_order");

  const [busy, setBusy] = useState(false);

  // Add-document form
  const [docKind, setDocKind] = useState("drawing");
  const [docTitle, setDocTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docNotes, setDocNotes] = useState("");

  // Delivery order form
  const [doRows, setDoRows] = useState<Array<{ description: string; qty: string; unit: string }>>([
    { description: "", qty: "1", unit: "pcs" },
  ]);

  async function postAction(action: string, extra: Record<string, any>, successMsg: string) {
    try {
      setBusy(true);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Action failed");
      }
      showToast(successMsg, "success");
      onRefresh();
      return true;
    } catch (e: any) {
      showToast(e.message || "Action failed", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const handleAddDocument = async () => {
    if (!docTitle.trim()) {
      showToast("Document title is required.", "error");
      return;
    }
    const ok = await postAction(
      "add_document",
      {
        kind: docKind,
        title: docTitle.trim(),
        url: docUrl.trim() || undefined,
        notes: docNotes.trim() || undefined,
      },
      "Document added."
    );
    if (ok) {
      setDocTitle("");
      setDocUrl("");
      setDocNotes("");
      setDocKind("drawing");
    }
  };

  const handleSign = async (doc: ProjectDocument) => {
    const name = window.prompt(`Sign-off name for "${doc.title}" (site owner / client rep):`, "");
    if (name === null) return;
    if (!name.trim()) {
      showToast("Signer name is required.", "error");
      return;
    }
    await postAction(
      "sign_document",
      { documentId: doc.id, signedByName: name.trim() },
      "Document signed."
    );
  };

  const handleCreateDo = async () => {
    const items = doRows
      .filter((r) => r.description.trim())
      .map((r) => ({
        description: r.description.trim(),
        qty: Number(r.qty) || 0,
        unit: r.unit.trim() || "pcs",
      }));
    if (items.length === 0) {
      showToast("Add at least one delivery item.", "error");
      return;
    }
    const ok = await postAction("create_delivery_order", { items }, "Delivery order created.");
    if (ok) setDoRows([{ description: "", qty: "1", unit: "pcs" }]);
  };

  const docStatusChip = (status?: string | null) => {
    const s = (status || "pending").toLowerCase();
    const cls =
      s === "approved"
        ? "bg-emerald-100 text-emerald-800"
        : s === "rejected"
        ? "bg-rose-100 text-rose-800"
        : "bg-amber-100 text-amber-800";
    return (
      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize", cls)}>
        {s.replace(/_/g, " ")}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* ============================ DOCUMENTS ============================ */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#FAFAFA] border-b border-[#E4E4E7]">
          <h3 className="text-xs font-bold text-[#18181B] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0D7A5F]" />
            Project Documents — Drawings, WCC & MIR
          </h3>
          <p className="text-[11px] text-[#71717A] mt-0.5">
            Drawings are approved by the Project Manager; Work Completion Certificates (WCC) and
            Material Inspection Reports (MIR) are signed off by the site owner / client.
          </p>
        </div>

        <div className="p-4 space-y-4">
          {documents.length === 0 ? (
            <p className="text-xs text-[#71717A] italic">No documents registered for this project yet.</p>
          ) : (
            <div className="divide-y divide-[#E4E4E7] border border-[#E4E4E7] rounded-lg overflow-hidden">
              {documents.map((doc) => {
                const meta = KIND_META[doc.kind] || KIND_META.other;
                const status = (doc.status || "pending").toLowerCase();
                const isSignable = doc.kind === "wcc" || doc.kind === "mir";
                return (
                  <div key={doc.id} className="px-3 py-2.5 flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide",
                          meta.cls
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs font-bold text-[#18181B]">{doc.title}</span>
                      {docStatusChip(doc.status)}
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0D7A5F] hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Open file
                        </a>
                      )}
                      <span className="ml-auto flex items-center gap-1.5">
                        {canApproveDocs && status !== "approved" && status !== "rejected" && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => postAction("approve_document", { documentId: doc.id }, "Document approved.")}
                              className={cn(btnGhost, "text-emerald-700 border-emerald-200 hover:bg-emerald-50")}
                            >
                              <Check className="w-3 h-3" /> Approve
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => postAction("reject_document", { documentId: doc.id }, "Document rejected.")}
                              className={cn(btnGhost, "text-rose-700 border-rose-200 hover:bg-rose-50")}
                            >
                              <X className="w-3 h-3" /> Reject
                            </button>
                          </>
                        )}
                        {canApproveDocs && isSignable && !doc.signedByName && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleSign(doc)}
                            className={btnGhost}
                          >
                            <PenLine className="w-3 h-3" /> Sign
                          </button>
                        )}
                      </span>
                    </div>
                    {(doc.notes || doc.signedByName || doc.createdAt) && (
                      <p className="text-[11px] text-[#71717A]">
                        {doc.notes && <span>{doc.notes} </span>}
                        {doc.signedByName && (
                          <span className="text-emerald-700 font-semibold">
                            Signed by {doc.signedByName}
                            {doc.signedAt ? ` on ${formatDate(doc.signedAt)}` : ""}
                          </span>
                        )}
                        {doc.createdAt && <span> · Added {formatDate(doc.createdAt)}</span>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add document */}
          <div className="pt-3 border-t border-dashed border-[#E4E4E7]">
            <h4 className="text-[11px] font-bold text-[#18181B] uppercase tracking-wider mb-2">
              Add Document
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <select value={docKind} onChange={(e) => setDocKind(e.target.value)} className={cn(selectCls, "sm:col-span-2")}>
                <option value="drawing">Drawing</option>
                <option value="wcc">WCC</option>
                <option value="mir">MIR</option>
                <option value="other">Other</option>
              </select>
              <input
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Title e.g. Ground floor HVAC layout rev 2"
                className={cn(inputCls, "sm:col-span-4")}
              />
              <input
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="File URL (optional)"
                className={cn(inputCls, "sm:col-span-3")}
              />
              <input
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                placeholder="Notes (optional)"
                className={cn(inputCls, "sm:col-span-2")}
              />
              <button type="button" onClick={handleAddDocument} disabled={busy} className={btnPrimary}>
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================= DELIVERY ORDERS ========================= */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#FAFAFA] border-b border-[#E4E4E7]">
          <h3 className="text-xs font-bold text-[#18181B] flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#0D7A5F]" />
            Delivery Orders (DO) — Material to Site
          </h3>
        </div>
        <div className="p-4 space-y-4">
          {deliveryOrders.length === 0 ? (
            <p className="text-xs text-[#71717A] italic">No delivery orders issued for this project yet.</p>
          ) : (
            <div className="space-y-2">
              {deliveryOrders.map((d) => (
                <div key={d.id} className="border border-[#E4E4E7] rounded-lg px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#18181B]">
                      {d.doNumber || "DO"}
                    </span>
                    {d.status && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F4F4F5] text-[#52525B] capitalize">
                        {d.status.replace(/_/g, " ")}
                      </span>
                    )}
                    {d.createdAt && (
                      <span className="text-[11px] text-[#71717A]">{formatDate(d.createdAt)}</span>
                    )}
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {(d.items || []).map((it, idx) => (
                      <li key={idx} className="text-[11px] text-[#52525B] flex items-center gap-1.5">
                        <ClipboardList className="w-3 h-3 text-[#A1A1AA]" />
                        {it.description} — <span className="font-mono font-bold">{it.qty} {it.unit}</span>
                      </li>
                    ))}
                  </ul>
                  {d.notes && <p className="text-[11px] text-[#71717A] mt-1">{d.notes}</p>}
                </div>
              ))}
            </div>
          )}

          {canCreateDo && (
            <div className="pt-3 border-t border-dashed border-[#E4E4E7]">
              <h4 className="text-[11px] font-bold text-[#18181B] uppercase tracking-wider mb-2">
                New Delivery Order
              </h4>
              <div className="space-y-2">
                {doRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <input
                      value={row.description}
                      onChange={(e) =>
                        setDoRows((prev) => prev.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)))
                      }
                      placeholder="Material description"
                      className={cn(inputCls, "col-span-6")}
                    />
                    <input
                      type="number"
                      min="0"
                      value={row.qty}
                      onChange={(e) =>
                        setDoRows((prev) => prev.map((r, i) => (i === idx ? { ...r, qty: e.target.value } : r)))
                      }
                      placeholder="Qty"
                      className={cn(inputCls, "col-span-2")}
                    />
                    <input
                      value={row.unit}
                      onChange={(e) =>
                        setDoRows((prev) => prev.map((r, i) => (i === idx ? { ...r, unit: e.target.value } : r)))
                      }
                      placeholder="Unit"
                      className={cn(inputCls, "col-span-2")}
                    />
                    <button
                      type="button"
                      onClick={() => setDoRows((prev) => prev.filter((_, i) => i !== idx))}
                      disabled={doRows.length === 1}
                      className={cn(btnGhost, "col-span-2 justify-center")}
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setDoRows((prev) => [...prev, { description: "", qty: "1", unit: "pcs" }])}
                  className={btnGhost}
                >
                  <Plus className="w-3 h-3" /> Add Row
                </button>
                <button type="button" onClick={handleCreateDo} disabled={busy} className={btnPrimary}>
                  <Truck className="w-3.5 h-3.5" /> Create DO
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
