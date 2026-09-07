import React from "react";
import { cn } from "@/lib/utils";

interface BarData {
  day: string;
  value: number;
  isCurrent?: boolean;
}

interface MiniBarChartProps {
  title: string;
  subtitle?: string;
  data: BarData[];
  height?: number;
}

export default function MiniBarChart({
  title,
  subtitle,
  data,
  height = 100,
}: MiniBarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="erp-card p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-semibold text-charcoal-muted uppercase tracking-wider">
            {title}
          </h3>
          {subtitle && (
            <p className="text-lg font-bold text-charcoal mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-2 pt-2" style={{ height }}>
        {data.map((item, idx) => {
          const barHeightPercent = Math.max(12, (item.value / maxValue) * 100);
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
              <span className="text-[10px] font-medium text-charcoal-muted opacity-0 group-hover:opacity-100 transition">
                {item.value}
              </span>
              <div
                className={cn(
                  "w-full rounded-t-lg transition-all duration-300",
                  item.isCurrent
                    ? "bg-primary shadow-sm"
                    : "bg-gray-200 hover:bg-gray-300"
                )}
                style={{ height: `${barHeightPercent}%` }}
              />
              <span
                className={cn(
                  "text-[11px] font-medium transition",
                  item.isCurrent ? "text-primary font-bold" : "text-charcoal-muted"
                )}
              >
                {item.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
