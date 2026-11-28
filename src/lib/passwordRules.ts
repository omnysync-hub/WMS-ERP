/**
 * Client-side mirrors of the server-enforced password policies.
 *
 * SOURCE OF TRUTH (keep in sync — these files win any disagreement):
 *  - WEB:    `validateErpPassword` in src/lib/auth/webAuth.ts
 *            (POST /api/users, PATCH /api/users/[id], POST /api/auth/change-password)
 *  - MOBILE: `validatePasswordStrength` in src/lib/auth/mobileAuth.ts
 *            (POST /api/employees/[id]/mobile-login/create + /reset-password)
 *
 * These definitions power the LIVE checklists in the UI only. They never
 * replace the server validation, which stays the backstop.
 */

export interface PasswordRule {
  id: string;
  /** Short label shown in the live checklist. */
  label: string;
  /** Full sentence shown as the inline error — worded exactly like the server's message. */
  errorText: string;
  test: (password: string) => boolean;
}

/** Mirrors validateErpPassword (src/lib/auth/webAuth.ts) rule-for-rule, in the same order. */
export const WEB_PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "At least 10 characters",
    errorText: "Password must be at least 10 characters.",
    test: (pw) => pw.length >= 10,
  },
  {
    id: "uppercase",
    label: "An uppercase letter (A–Z)",
    errorText: "Password must contain an uppercase letter.",
    test: (pw) => /[A-Z]/.test(pw),
  },
  {
    id: "lowercase",
    label: "A lowercase letter (a–z)",
    errorText: "Password must contain a lowercase letter.",
    test: (pw) => /[a-z]/.test(pw),
  },
  {
    id: "number",
    label: "A number (0–9)",
    errorText: "Password must contain a number.",
    test: (pw) => /\d/.test(pw),
  },
  {
    id: "special",
    label: "A special character (e.g. ! @ # $)",
    errorText: "Password must contain a special character.",
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
  },
];

/** Mirrors validatePasswordStrength (src/lib/auth/mobileAuth.ts) rule-for-rule. */
export const MOBILE_PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "At least 8 characters",
    errorText: "Password must be at least 8 characters long.",
    test: (pw) => pw.length >= 8,
  },
  {
    id: "edgeSpaces",
    label: "No spaces at the start or end",
    errorText: "Password cannot start or end with a space.",
    test: (pw) => pw === pw.trim(),
  },
  {
    id: "maxLength",
    label: "No more than 128 characters",
    errorText: "Password cannot be longer than 128 characters.",
    test: (pw) => pw.length <= 128,
  },
];

export type PasswordPolicy = "web" | "mobile";

export function passwordRulesFor(policy: PasswordPolicy): PasswordRule[] {
  return policy === "web" ? WEB_PASSWORD_RULES : MOBILE_PASSWORD_RULES;
}

export interface PasswordRuleResult {
  rule: PasswordRule;
  satisfied: boolean;
}

export function evaluatePasswordRules(
  rules: PasswordRule[],
  password: string
): PasswordRuleResult[] {
  return rules.map((rule) => ({ rule, satisfied: rule.test(password) }));
}

/** True when every rule passes. An empty password never satisfies a policy. */
export function passwordSatisfiesRules(rules: PasswordRule[], password: string): boolean {
  return password.length > 0 && rules.every((rule) => rule.test(password));
}

export function passwordSatisfiesPolicy(policy: PasswordPolicy, password: string): boolean {
  return passwordSatisfiesRules(passwordRulesFor(policy), password);
}

/** The first failing rule (in policy order) — its errorText matches the server's message. */
export function firstFailingPasswordRule(
  rules: PasswordRule[],
  password: string
): PasswordRule | null {
  return rules.find((rule) => !rule.test(password)) ?? null;
}
