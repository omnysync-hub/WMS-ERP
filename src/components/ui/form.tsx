"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared form-validation display primitives.
 *
 * Pattern used across the ERP's create/edit forms:
 *  - Required fields carry a visible rose asterisk in the label.
 *  - A field's error shows INLINE under the field (never only as a toast/alert):
 *    it appears on blur, updates live while typing after that, and a submit
 *    attempt reveals every invalid field at once and focuses the first one.
 *  - The wrapper of a field that is currently showing an error carries
 *    `data-field-invalid="true"` so `focusFirstInvalidField` can find it.
 */

/** Classes merged onto an input/select/textarea while its error is visible. */
export const INVALID_FIELD_CLS =
  "border-rose-400 focus:border-rose-500 focus:ring-rose-200";

/** The standard inline error line rendered under an invalid field. */
export function FieldErrorText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn(
        "mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600 animate-in fade-in",
        className
      )}
    >
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export interface FormFieldProps {
  label?: React.ReactNode;
  /** Shows the rose asterisk and (by convention) marks the field as required. */
  required?: boolean;
  /** The field's current validation error, or null/undefined when valid. */
  error?: string | null;
  /** Reveal the error (field blurred, or a submit was attempted). */
  showError?: boolean;
  /** Small print rendered under the field (after any error). */
  hint?: React.ReactNode;
  labelClassName?: string;
  className?: string;
  children: (api: { invalid: boolean }) => React.ReactNode;
}

const DEFAULT_LABEL_CLS = "block text-xs font-semibold text-[#18181B] mb-1";

/**
 * Label + control + inline-error wrapper. The control is supplied via a
 * render prop so each form keeps its own input styling; `invalid` tells the
 * control to merge INVALID_FIELD_CLS while the error is visible.
 */
export function FormField({
  label,
  required,
  error,
  showError,
  hint,
  labelClassName,
  className,
  children,
}: FormFieldProps) {
  const invalid = Boolean(error) && Boolean(showError);
  return (
    <div className={className} data-field-invalid={invalid ? "true" : undefined}>
      {label != null && (
        <label className={labelClassName ?? DEFAULT_LABEL_CLS}>
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </label>
      )}
      {children({ invalid })}
      {invalid && error ? <FieldErrorText>{error}</FieldErrorText> : null}
      {hint}
    </div>
  );
}

/**
 * After a submit attempt, scroll to the first field currently showing an
 * error (marked with data-field-invalid="true") and focus its control.
 * Returns true when a field was found.
 */
export function focusFirstInvalidField(root: HTMLElement | null | undefined): boolean {
  if (!root) return false;
  const target = root.querySelector<HTMLElement>('[data-field-invalid="true"]');
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  const focusable = target.matches("input, select, textarea, button, [tabindex]")
    ? target
    : target.querySelector<HTMLElement>("input, select, textarea, button, [tabindex]");
  if (focusable) {
    window.setTimeout(() => focusable.focus({ preventScroll: true }), 250);
  }
  return true;
}
