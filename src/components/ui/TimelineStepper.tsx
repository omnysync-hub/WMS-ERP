import React from "react";
import { Check, Clock, AlertCircle } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

export interface TimelineStep {
  status: string;
  label: string;
  isCompleted: boolean;
  isCurrent: boolean;
  timestamp?: string | Date | null;
  changedBy?: string | null;
}

interface TimelineStepperProps {
  steps: TimelineStep[];
}

export default function TimelineStepper({ steps }: TimelineStepperProps) {
  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-charcoal-border">
      {steps.map((step, idx) => {
        return (
          <div key={idx} className="relative flex items-start gap-4 group">
            {/* Step Icon / Dot */}
            <div
              className={cn(
                "absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all z-10",
                step.isCompleted
                  ? "bg-primary text-white shadow-sm"
                  : step.isCurrent
                  ? "bg-amber-500 text-white ring-4 ring-amber-100"
                  : "bg-white border-2 border-charcoal-border text-transparent"
              )}
            >
              {step.isCompleted ? (
                <Check className="w-3 h-3 stroke-[3]" />
              ) : step.isCurrent ? (
                <Clock className="w-3 h-3" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              )}
            </div>

            {/* Step Content */}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p
                  className={cn(
                    "text-xs font-semibold tracking-tight",
                    step.isCurrent
                      ? "text-primary font-bold text-sm"
                      : step.isCompleted
                      ? "text-charcoal font-medium"
                      : "text-charcoal-muted"
                  )}
                >
                  {step.label}
                </p>
                {step.timestamp && (
                  <span className="text-[10px] text-charcoal-muted font-mono">
                    {formatDateTime(step.timestamp)}
                  </span>
                )}
              </div>

              {step.changedBy && (
                <p className="text-[11px] text-charcoal-secondary mt-0.5">
                  by <span className="font-medium text-charcoal">{step.changedBy}</span>
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
