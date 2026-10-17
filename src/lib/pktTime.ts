/**
 * Pakistan Standard Time helpers (Asia/Karachi, fixed UTC+05:00, no DST).
 * Servers (Vercel) run in UTC, so `new Date(y, m, d)` / `setHours(0)` give UTC days.
 * Use these for every "today / this week / custom date" report boundary.
 */
export const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Calendar parts of an instant as seen on a clock in Pakistan. */
export function pktParts(date: Date = new Date()) {
  const shifted = new Date(date.getTime() + PKT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/** Instant of 00:00:00.000 PKT on the given PKT calendar day (month 0-based; day may overflow). */
export function pktStartOfDay(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day) - PKT_OFFSET_MS);
}

/** Instant of 23:59:59.999 PKT on the given PKT calendar day. */
export function pktEndOfDay(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day + 1) - PKT_OFFSET_MS - 1);
}

/** Parse "YYYY-MM-DD" (or any date string) as a PKT calendar day. Returns null if invalid. */
export function pktDayFromString(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (m) return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : pktParts(d);
}

/** 00:00 PKT of the PKT day containing `now`. */
export function pktTodayStart(now: Date = new Date()) {
  const { year, month, day } = pktParts(now);
  return pktStartOfDay(year, month, day);
}
