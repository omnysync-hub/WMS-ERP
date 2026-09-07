import React from "react";

interface ProgressRingProps {
  percentage: number;
  label: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
}

export default function ProgressRing({
  percentage,
  label,
  sublabel,
  size = 140,
  strokeWidth = 12,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#EFEFEF"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#0D7A5F"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Percentage */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-charcoal tracking-tight">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>

      {/* Label and Sublabel */}
      <div className="text-center mt-3">
        <p className="text-xs font-bold text-charcoal">{label}</p>
        {sublabel && (
          <p className="text-[11px] text-charcoal-muted mt-0.5">{sublabel}</p>
        )}
      </div>
    </div>
  );
}
