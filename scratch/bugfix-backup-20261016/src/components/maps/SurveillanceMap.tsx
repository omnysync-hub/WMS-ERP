"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { PingData, OfflineGapData } from "./RealSurveillanceMap";

interface SurveillanceMapProps {
  pings: PingData[];
  gaps: OfflineGapData[];
  currentPingIndex: number;
  onSelectPingIndex?: (index: number) => void;
  technicianName: string;
}

const RealSurveillanceMap = dynamic(() => import("./RealSurveillanceMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[540px] rounded-xl bg-[#18181B] border border-zinc-800 flex flex-col items-center justify-center text-zinc-400 gap-3">
      <Loader2 className="w-8 h-8 text-[#0D7A5F] animate-spin" />
      <span className="text-xs font-semibold">Initializing Surveillance Satellite Trajectory...</span>
    </div>
  ),
});

export default function SurveillanceMap(props: SurveillanceMapProps) {
  return <RealSurveillanceMap {...props} />;
}
