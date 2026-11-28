"use client";

import React, { useState } from "react";
import { Check, Circle, Eye, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  evaluatePasswordRules,
  firstFailingPasswordRule,
  passwordRulesFor,
  type PasswordPolicy,
} from "@/lib/passwordRules";
import { FieldErrorText, INVALID_FIELD_CLS } from "@/components/ui/form";

/**
 * Password input with a LIVE rules checklist.
 *
 * The checklist mirrors the server-enforced policy for the surface
 * (see src/lib/passwordRules.ts): every rule ticks green as it is satisfied
 * while typing, stays neutral before typing, and turns red only for rules
 * the user is actively failing (typed something, blurred, or submitted).
 * The first failing rule also shows as an inline error — worded exactly
 * like the server's own message — instead of a surprise error at submit.
 */

const DEFAULT_LABEL_CLS = "block text-[11px] font-mono text-[#71717A] mb-1";
const DEFAULT_INPUT_CLS =
  "w-full bg-white border border-[#D4D4D8] rounded-lg px-3 py-1.5 text-xs text-[#18181B] focus:ring-1 focus:ring-[#0D7A5F] focus:border-[#0D7A5F] outline-none";

export interface PasswordFieldProps {
  label?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  /** Which server policy this surface enforces: ERP web users or mobile app logins. */
  policy: PasswordPolicy;
  required?: boolean;
  /**
   * When true, an empty value is valid (e.g. "leave blank to keep current"
   * on the edit-user form) and no error shows until something is typed.
   */
  optional?: boolean;
  placeholder?: string;
  autoComplete?: string;
  labelClassName?: string;
  inputClassName?: string;
  /** Small print under the checklist (e.g. session sign-out notes). */
  hint?: React.ReactNode;
  /** Rendered at the right of the label row (e.g. a Generate button). */
  headerAction?: React.ReactNode;
  /** Extra control(s) inside the input, left of the show/hide eye (e.g. Copy). */
  trailingAction?: React.ReactNode;
  /** Set true by the host when a submit was attempted — reveals all failures. */
  submitAttempted?: boolean;
  onBlur?: () => void;
  /** Controlled visibility (optional — the reset-password drawer pre-shows generated passwords). */
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  id?: string;
  name?: string;
}

export default function PasswordField({
  label,
  value,
  onChange,
  policy,
  required,
  optional,
  placeholder,
  autoComplete = "new-password",
  labelClassName,
  inputClassName,
  hint,
  headerAction,
  trailingAction,
  submitAttempted,
  onBlur,
  visible,
  onVisibleChange,
  id,
  name,
}: PasswordFieldProps) {
  const [internalVisible, setInternalVisible] = useState(false);
  const [touched, setTouched] = useState(false);

  const showPassword = visible !== undefined ? visible : internalVisible;
  const setShowPassword = (next: boolean) => {
    if (onVisibleChange) onVisibleChange(next);
    if (visible === undefined) setInternalVisible(next);
  };

  const rules = passwordRulesFor(policy);
  const results = evaluatePasswordRules(rules, value);
  const isEmptyOptional = Boolean(optional) && value.length === 0;
  const allSatisfied = results.every((r) => r.satisfied);
  const valid = isEmptyOptional || allSatisfied;

  // Rules read as "failing" (red) only once the user is engaged with the
  // field: they typed something, blurred it, or attempted a submit.
  const engaged = value.length > 0 || touched || Boolean(submitAttempted);
  const showError = !valid && (touched || Boolean(submitAttempted));
  const failingRule = !valid ? firstFailingPasswordRule(rules, value) : null;

  return (
    <div data-field-invalid={showError ? "true" : undefined}>
      {(label != null || headerAction) && (
        <div className="flex items-center justify-between mb-1">
          {label != null ? (
            <label htmlFor={id} className={cn(labelClassName ?? DEFAULT_LABEL_CLS, "mb-0")}>
              {label}
              {required && <span className="text-rose-500"> *</span>}
            </label>
          ) : (
            <span />
          )}
          {headerAction}
        </div>
      )}

      <div className="relative">
        <input
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            setTouched(true);
            onBlur?.();
          }}
          aria-invalid={showError || undefined}
          className={cn(
            inputClassName ?? DEFAULT_INPUT_CLS,
            trailingAction ? "pr-16" : "pr-10",
            showError && INVALID_FIELD_CLS
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {trailingAction}
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="p-1 text-[#71717A] hover:text-[#18181B] hover:bg-slate-100 rounded"
            title={showPassword ? "Hide password" : "Show password"}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Live rules checklist */}
      <ul className="mt-2 grid gap-1 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 py-2">
        {results.map(({ rule, satisfied }) => {
          const state = satisfied ? "ok" : engaged ? "fail" : "idle";
          return (
            <li
              key={rule.id}
              className={cn(
                "flex items-center gap-1.5 text-[11px] leading-4 transition-colors",
                state === "ok" && "text-emerald-700 font-medium",
                state === "fail" && "text-rose-600",
                state === "idle" && "text-[#71717A]"
              )}
            >
              {state === "ok" ? (
                <Check className="w-3.5 h-3.5 shrink-0" />
              ) : state === "fail" ? (
                <X className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Circle className="w-3 h-3 shrink-0" />
              )}
              <span>{rule.label}</span>
            </li>
          );
        })}
      </ul>

      {showError && failingRule ? (
        <FieldErrorText>{failingRule.errorText}</FieldErrorText>
      ) : null}
      {hint}
    </div>
  );
}
