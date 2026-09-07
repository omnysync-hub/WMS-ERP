"use client";

import React from "react";
import { X, Smartphone, ExternalLink } from "lucide-react";
import Link from "next/link";

interface MobileSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSimulatorModal({ isOpen, onClose }: MobileSimulatorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col items-center">
        {/* Floating Top Controls */}
        <div className="w-full max-w-sm flex items-center justify-between text-white mb-3 px-2">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold tracking-wide">
              Technician App Simulator
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/mobile"
              target="_blank"
              className="text-[11px] text-gray-300 hover:text-white flex items-center gap-1 bg-white/10 px-2 py-1 rounded-md"
            >
              <ExternalLink className="w-3 h-3" />
              New Tab
            </Link>
            <button
              onClick={onClose}
              className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Smartphone Bezel & Viewport */}
        <div className="w-[380px] h-[740px] bg-[#1E2022] rounded-[48px] p-3 shadow-2xl ring-1 ring-white/20 relative flex flex-col items-center">
          {/* Speaker / Dynamic Island Notch */}
          <div className="w-28 h-5 bg-black rounded-full mb-1 flex items-center justify-center gap-2 z-20">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
            <div className="w-2 h-2 rounded-full bg-blue-950" />
          </div>

          {/* Iframe Viewport */}
          <div className="w-full h-full bg-white rounded-[38px] overflow-hidden relative">
            <iframe
              src="/mobile"
              className="w-full h-full border-0"
              title="Mobile Companion App"
            />
          </div>

          {/* Home indicator bar */}
          <div className="w-32 h-1 bg-zinc-600 rounded-full mt-2" />
        </div>
      </div>
    </div>
  );
}
