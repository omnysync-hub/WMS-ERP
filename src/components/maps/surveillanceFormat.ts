/**
 * Shared surveillance display formatters.
 *
 * These live in a leaf module (no Leaflet import) so both the surveillance
 * page and RealSurveillanceMap can use one implementation without the page
 * statically importing the Leaflet-heavy map component (which must stay
 * behind the ssr:false dynamic boundary in SurveillanceMap.tsx).
 */

/** Battery levels arrive from the app as 0–1 fractions; render as a rounded percent. */
export function formatBatteryPercent(level: number): string {
  const pct = level <= 1 ? level * 100 : level;
  return `${Math.round(pct)}%`;
}

/** Human-readable duration ("9h 32m", "45 min") instead of an ambiguous "571.6m". */
export function formatDurationMinutes(mins: number): string {
  const total = Math.round(mins);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
