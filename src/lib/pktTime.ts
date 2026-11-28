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

/** "YYYY-MM-DD" of an instant as seen on a clock in Pakistan. */
export function pktDateString(date: Date = new Date()): string {
  const { year, month, day } = pktParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Interpret a `datetime-local` input value ("YYYY-MM-DDTHH:mm") as Pakistan
 * wall-clock time and return the corresponding instant. `new Date(value)`
 * would parse it in the VIEWER's timezone instead, silently shifting the
 * window for anyone not in Pakistan. Falls back to `new Date(value)` for
 * values that do not match the datetime-local shape.
 */
export function pktDateTimeLocalToInstant(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value || "");
  if (!m) return new Date(value);
  return new Date(
    Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] || 0)
    ) - PKT_OFFSET_MS
  );
}

// ---------------------------------------------------------------------------
// Display formatting — ALWAYS Asia/Karachi, regardless of the viewer's or the
// server's timezone. Operational data belongs to Pakistan; a manager abroad
// (or a server in Europe) must still see Lahore time. Display-only: these
// never change stored values or comparisons.
// ---------------------------------------------------------------------------

export const PKT_TIME_ZONE = "Asia/Karachi";

function asDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

const pktTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: PKT_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const pktDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: PKT_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "9:02 AM" in Pakistan time. */
export function formatPktTime(value: Date | string | number): string {
  return pktTimeFormat.format(asDate(value));
}

/** "Nov 28, 2026" in Pakistan time. */
export function formatPktDate(value: Date | string | number): string {
  return pktDateFormat.format(asDate(value));
}

/** "Nov 28, 2026, 9:02 AM" in Pakistan time. */
export function formatPktDateTime(value: Date | string | number): string {
  return `${formatPktDate(value)}, ${formatPktTime(value)}`;
}
