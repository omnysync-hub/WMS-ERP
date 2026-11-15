/**
 * Per-app mobile access provisioning.
 *
 * One ERP employee credential (username/phone + password) can be enabled for
 * each of the three mobile apps independently. HR manages the three flags
 * from the employee's Mobile Access tab; the mobile login route enforces
 * them when the app identifies itself with `appId` in the login body.
 *
 * Apps: "main" (Workman field app), "bikes" (Bikes Workshop), "hvac" (HVAC Workshop).
 */

export type AppId = "main" | "bikes" | "hvac";

export const APP_LABELS: Record<AppId, string> = {
  main: "Workman App",
  bikes: "Bikes Workshop App",
  hvac: "HVAC Workshop App",
};

export const APP_ACCESS_FIELDS: Record<AppId, "appAccessMain" | "appAccessBikes" | "appAccessHvac"> = {
  main: "appAccessMain",
  bikes: "appAccessBikes",
  hvac: "appAccessHvac",
};

/** Accepts the app identifiers the mobile apps send, plus friendly aliases. */
export function normalizeAppId(raw: unknown): AppId | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "main" || v === "workman" || v === "workman-mobile") return "main";
  if (v === "bikes" || v === "bike" || v === "workman-bikes-mobile") return "bikes";
  if (v === "hvac" || v === "workman-hvac-mobile") return "hvac";
  return null;
}

type AppAccessShape = {
  appAccessMain?: boolean | null;
  appAccessBikes?: boolean | null;
  appAccessHvac?: boolean | null;
};

export function employeeHasAppAccess(employee: AppAccessShape, app: AppId): boolean {
  return Boolean(employee[APP_ACCESS_FIELDS[app]]);
}

export function appAccessSummary(employee: AppAccessShape): Record<AppId, boolean> {
  return {
    main: Boolean(employee.appAccessMain),
    bikes: Boolean(employee.appAccessBikes),
    hvac: Boolean(employee.appAccessHvac),
  };
}
