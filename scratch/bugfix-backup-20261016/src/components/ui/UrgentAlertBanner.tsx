"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Package, Percent, Volume2, VolumeX, X, ArrowRight, BellRing } from "lucide-react";
import { urgentAlertManager, UrgentAlert } from "@/lib/notificationAudio";

export default function UrgentAlertBanner() {
  const [alerts, setAlerts] = useState<UrgentAlert[]>([]);

  useEffect(() => {
    const unsub = urgentAlertManager.subscribe((list) => {
      setAlerts(list);
    });
    return () => unsub();
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-3 right-3 sm:right-6 z-[9999] max-w-md w-full space-y-2 pointer-events-auto">
      {alerts.map((alert) => {
        const isStock = alert.type === "inventory";

        return (
          <div
            key={alert.id}
            className={`rounded-xl border shadow-xl p-4 transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
              isStock
                ? "bg-amber-500/95 text-white border-amber-400 backdrop-blur-md shadow-amber-500/20"
                : "bg-purple-600/95 text-white border-purple-400 backdrop-blur-md shadow-purple-600/20"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                    isStock ? "bg-amber-600 text-white" : "bg-purple-700 text-white"
                  }`}
                >
                  {isStock ? <Package className="w-5 h-5 animate-bounce" /> : <Percent className="w-5 h-5 animate-bounce" />}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-black tracking-wider bg-black/25 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <BellRing className="w-3 h-3 animate-spin" />
                      {alert.isMuted ? "Sound Silenced" : "Repeating Alert Active"}
                    </span>
                    {alert.jobNumber && (
                      <span className="text-xs font-mono font-bold bg-white/20 px-2 py-0.5 rounded">
                        #{alert.jobNumber}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold mt-1 text-white leading-tight">
                    {alert.title}
                  </h4>
                  <p className="text-xs text-white/90 mt-0.5 leading-relaxed">
                    {alert.message}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => urgentAlertManager.resolveAlert(alert.id)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-black/20 transition"
                title="Dismiss alert notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-white/20 text-xs">
              <button
                type="button"
                onClick={() => urgentAlertManager.toggleMute(alert.id)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/25 hover:bg-black/35 font-semibold text-[11px] transition"
              >
                {alert.isMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-white/70" />
                    <span>Unmute Voice</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-white animate-pulse" />
                    <span>Silence Audio</span>
                  </>
                )}
              </button>

              {alert.jobId ? (
                <Link
                  href={`/jobs/${alert.jobId}`}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white text-zinc-900 font-bold text-[11px] hover:bg-zinc-100 transition shadow-xs"
                >
                  <span>{isStock ? "Issue Stock Now" : "Review Discount"}</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
