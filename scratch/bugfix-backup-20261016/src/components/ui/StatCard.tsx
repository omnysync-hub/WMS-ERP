import React from "react";
import { ArrowUpRight, ArrowDownRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  isPositive?: boolean;
  icon?: LucideIcon;
  onActionClick?: () => void;
}

export default function StatCard({
  label,
  value,
  delta,
  isPositive = true,
  icon: Icon,
  onActionClick,
}: StatCardProps) {
  return (
    <div className="erp-card erp-card-hover p-6 flex flex-col justify-between">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-charcoal-muted uppercase tracking-wider">
          {label}
        </span>
        <button
          onClick={onActionClick}
          title="View Details"
          className="w-8 h-8 rounded-full bg-background hover:bg-gray-100 flex items-center justify-center text-charcoal-secondary hover:text-charcoal transition"
        >
          {Icon ? <Icon className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Stat Number */}
      <div className="my-3">
        <span className="text-3xl font-extrabold text-charcoal tracking-tight">
          {value}
        </span>
      </div>

      {/* Delta / Context */}
      {delta && (
        <div className="flex items-center gap-1.5 text-xs">
          {isPositive ? (
            <span className="text-emerald-600 font-semibold flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              {delta}
            </span>
          ) : (
            <span className="text-rose-500 font-semibold flex items-center">
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
              {delta}
            </span>
          )}
          <span className="text-charcoal-muted">vs previous period</span>
        </div>
      )}
    </div>
  );
}
