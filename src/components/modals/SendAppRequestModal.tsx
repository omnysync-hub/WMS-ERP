"use client";

import React, { useState } from "react";
import {
  Send,
  X,
  Bell,
  AlertTriangle,
  Radio,
  Package,
  Navigation,
  CheckCircle2,
  Smartphone,
  Info,
} from "lucide-react";

interface SendAppRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  technician: {
    id: string;
    name: string;
    phone: string;
    currentStatus?: string;
  } | null;
  onSuccess?: (result: any) => void;
}

const PRESET_TEMPLATES = [
  {
    type: "EMERGENCY_ALERT",
    label: "🚨 Urgent Re-route",
    title: "Urgent: High Priority Re-routing",
    body: "Customer reported an emergency water leakage from outdoor unit. Please pause current minor work and re-route immediately.",
    priority: "urgent",
    actionRequired: true,
  },
  {
    type: "INVENTORY_ISSUED",
    label: "📦 Material Pickup",
    title: "Warehouse Materials Ready for Pickup",
    body: "Your requested 2HP compressor capacitor and copper tubing bundle have been issued at Central Store bay 4.",
    priority: "high",
    actionRequired: true,
  },
  {
    type: "PING_REQUEST",
    label: "📍 Location & Status Ping",
    title: "Dispatcher Status Check",
    body: "Please confirm your current arrival ETA at the job site.",
    priority: "normal",
    actionRequired: true,
  },
  {
    type: "GENERAL_MESSAGE",
    label: "💬 Direct Field Message",
    title: "Customer Access Update",
    body: "Security gate code is #4092. Ask for Mr. Tariq at reception upon arrival.",
    priority: "normal",
    actionRequired: false,
  },
];

export default function SendAppRequestModal({
  isOpen,
  onClose,
  technician,
  onSuccess,
}: SendAppRequestModalProps) {
  const [type, setType] = useState<string>("EMERGENCY_ALERT");
  const [title, setTitle] = useState(PRESET_TEMPLATES[0].title);
  const [body, setBody] = useState(PRESET_TEMPLATES[0].body);
  const [priority, setPriority] = useState<"urgent" | "high" | "normal">("urgent");
  const [actionRequired, setActionRequired] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !technician) return null;

  const selectPreset = (template: (typeof PRESET_TEMPLATES)[0]) => {
    setType(template.type);
    setTitle(template.title);
    setBody(template.body);
    setPriority(template.priority as any);
    setActionRequired(template.actionRequired);
    setError(null);
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setError("Title and message body cannot be blank.");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const res = await fetch("/api/mobile/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: technician.id,
          senderName: "Lead Dispatcher",
          senderRole: "dispatcher",
          type,
          title,
          body,
          priority,
          actionRequired,
          payload: {
            timestamp: new Date().toISOString(),
            dispatchSource: "Dispatcher Live Console",
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to dispatch request");
      }

      const result = await res.json();
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-[#E4E4E7] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E4E4E7] flex items-center justify-between bg-[#FAFAFA]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0D7A5F]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#1A1D1F] text-base">
                Send Direct Request to Mobile App
              </h3>
              <p className="text-xs text-[#71717A]">
                Dispatching to{" "}
                <span className="font-semibold text-[#1A1D1F]">
                  {technician.name}
                </span>{" "}
                ({technician.phone})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#1A1D1F] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Preset Badges */}
          <div>
            <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wider block mb-2">
              Quick Request Presets
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.label}
                  type="button"
                  onClick={() => selectPreset(tmpl)}
                  className={`p-2.5 rounded-xl border text-left text-xs font-medium transition flex items-center justify-between ${
                    title === tmpl.title
                      ? "bg-emerald-50/80 border-[#0D7A5F] text-[#0D7A5F] font-semibold"
                      : "bg-white border-[#E4E4E7] text-[#52525B] hover:bg-[#F4F4F5]"
                  }`}
                >
                  <span>{tmpl.label}</span>
                  {title === tmpl.title && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#0D7A5F]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-[#1A1D1F] block mb-1">
                Notification / Request Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs focus:outline-none focus:border-[#0D7A5F] transition"
                placeholder="e.g. Urgent Re-route, Material Ready..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#1A1D1F] block mb-1">
                Instruction Message
              </label>
              <textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E4E4E7] text-xs focus:outline-none focus:border-[#0D7A5F] transition resize-none"
                placeholder="Detailed instructions for the technician..."
              />
            </div>

            {/* Priority & Acknowledgment Settings */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-[#1A1D1F] block mb-1.5">
                  Priority Level
                </label>
                <div className="flex rounded-xl border border-[#E4E4E7] p-1 bg-[#F4F4F5] text-xs">
                  {(["normal", "high", "urgent"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-1 rounded-lg font-medium capitalize transition ${
                        priority === p
                          ? p === "urgent"
                            ? "bg-red-600 text-white font-bold"
                            : p === "high"
                            ? "bg-amber-600 text-white font-bold"
                            : "bg-white text-[#1A1D1F] font-bold shadow-xs"
                          : "text-[#71717A] hover:text-[#1A1D1F]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1A1D1F] block mb-1.5">
                  Technician Action
                </label>
                <label className="flex items-center gap-2 p-2 rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={actionRequired}
                    onChange={(e) => setActionRequired(e.target.checked)}
                    className="accent-[#0D7A5F] w-4 h-4 rounded"
                  />
                  <span className="font-medium text-[#1A1D1F]">
                    Require Tap to Acknowledge
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Live Mobile Phone Preview Banner */}
          <div className="p-3.5 rounded-xl bg-[#18181B] text-white border border-[#27272A] space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-zinc-400">
              <span className="flex items-center gap-1">
                <Bell className="w-3 h-3 text-[#0D7A5F]" /> Workman Mobile Companion
              </span>
              <span>Just now</span>
            </div>
            <p className="font-bold text-xs text-white leading-tight">{title || "Untitled"}</p>
            <p className="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed">
              {body || "No message content"}
            </p>
            {actionRequired && (
              <div className="flex gap-2 pt-1">
                <span className="px-2 py-0.5 rounded-md bg-[#0D7A5F] text-[10px] font-bold text-white">
                  Accept / Acknowledge
                </span>
                <span className="px-2 py-0.5 rounded-md bg-zinc-700 text-[10px] text-zinc-300">
                  Decline
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E4E4E7] bg-[#FAFAFA] flex items-center justify-between">
          <p className="text-[11px] text-[#71717A] flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-zinc-400" /> Dispatches via APNs/FCM + In-app stream
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-[#71717A] hover:text-[#1A1D1F] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending}
              className="px-4 py-2 rounded-xl bg-[#0D7A5F] hover:bg-[#0A634D] disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              {isSending ? "Dispatching..." : "Send to App"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
