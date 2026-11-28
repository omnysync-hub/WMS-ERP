/**
 * Position-integrity rules for incoming GPS fixes — one definition, shared
 * by the telemetry ingest (and unit-verifiable in isolation: this module is
 * pure, no Prisma, no I/O).
 *
 * The dispatcher's pin must sit on the technician's latest GOOD fix, not on
 * whatever arrived last. A phone that briefly loses GPS lock indoors can
 * report a fix with a 400 m error radius; letting that overwrite a 6 m
 * pinpoint from seconds earlier would teleport the pin across the street
 * and corrupt the day's route. These rules decide, for every fix, whether
 * it may move the stored position:
 *
 * 1. MOCKED fixes (OS reports a mock/fake location) never move the pin and
 *    never touch any Employee location field. The ping row is still stored
 *    with mocked=true — a visible audit trail of the rejected attempt.
 * 2. STALE fixes (device fix time far behind server receipt — e.g. an
 *    offline-queued ping replayed long after capture) never move the pin:
 *    the position must not jump backwards in time. The row is still stored.
 * 3. SLOPPY fixes (accuracy radius worse than GOOD_FIX_MAX_ACCURACY_M) do
 *    not overwrite a stored position that is both RECENT (set within
 *    POSITION_PROTECT_MS) and BETTER (its own accuracy radius is smaller —
 *    or unknown-but-recent, which still beats a KNOWN-bad fix). A sloppy fix
 *    DOES update the position when there is no stored position, when the
 *    stored one is old, or when it is no worse than the stored fix's
 *    accuracy: a rough current position beats a fossil.
 *
 * Accuracy semantics: null (OS reported none) and 0 (legacy app builds sent
 * `accuracy ?? 0`) both mean UNKNOWN — an unknown-accuracy fix is treated as
 * acceptable, because it cannot be judged sloppy.
 */

/** Fixes with an accuracy radius above this (metres) are "sloppy". */
export const GOOD_FIX_MAX_ACCURACY_M = 100;
/** A stored position younger than this is protected from sloppy overwrites. */
export const POSITION_PROTECT_MS = 30 * 60 * 1000;
/** A device fix older than this at receipt time is stale for position use. */
export const STALE_FIX_MS = 5 * 60 * 1000;
/** Device clocks may run ahead of the server; small leads are ignored. */
export const FUTURE_TOLERANCE_MS = 2 * 60 * 1000;

export interface StoredPosition {
  lat: number | null;
  lng: number | null;
  /** When the stored position was set (epoch ms), or null if never. */
  goodFixAtMs: number | null;
  /** Accuracy radius (m) of the fix that set the position; null = unknown. */
  accuracyM: number | null;
}

export interface IncomingFix {
  /** Accuracy radius (m) of the incoming fix; null/0 = unknown. */
  accuracyM: number | null;
  mocked: boolean;
  /** Device-side fix time (epoch ms) when the client sent one, else null. */
  deviceTimestampMs: number | null;
  /** Server receipt time (epoch ms). */
  receivedAtMs: number;
}

export type PositionDecisionReason = "ok" | "mocked" | "stale" | "sloppy_kept_pinpoint";

export interface PositionDecision {
  /** May this fix overwrite the stored Employee position? */
  updatePosition: boolean;
  reason: PositionDecisionReason;
}

/** True when an accuracy value is KNOWN and worse than the good-fix bar. */
export function isSloppyAccuracy(accuracyM: number | null | undefined): boolean {
  return accuracyM != null && accuracyM > 0 && accuracyM > GOOD_FIX_MAX_ACCURACY_M;
}

export function assessIncomingFix(
  fix: IncomingFix,
  stored: StoredPosition | null
): PositionDecision {
  // 1. Mocked: rejected for position purposes entirely.
  if (fix.mocked) {
    return { updatePosition: false, reason: "mocked" };
  }

  // 2. Stale: the fix's own timestamp lags receipt by more than the
  // threshold. A device timestamp slightly in the future (clock skew) is
  // ignored rather than treated as evidence of anything.
  if (fix.deviceTimestampMs != null) {
    const lagMs = fix.receivedAtMs - fix.deviceTimestampMs;
    if (lagMs > STALE_FIX_MS) {
      return { updatePosition: false, reason: "stale" };
    }
  }

  // 3. Sloppy vs a recent, better stored pinpoint.
  if (isSloppyAccuracy(fix.accuracyM)) {
    const hasStored = stored != null && stored.lat != null && stored.lng != null;
    if (hasStored && stored.goodFixAtMs != null) {
      const storedAgeMs = fix.receivedAtMs - stored.goodFixAtMs;
      if (storedAgeMs >= 0 && storedAgeMs <= POSITION_PROTECT_MS) {
        // Stored accuracy unknown counts as "not proven worse": a fresh
        // position of unknown quality still beats a KNOWN-bad fix. A known
        // stored accuracy protects only when it is better (smaller) — an
        // equally sloppy stored fix may be refreshed by the new one.
        if (stored.accuracyM == null || stored.accuracyM < (fix.accuracyM as number)) {
          return { updatePosition: false, reason: "sloppy_kept_pinpoint" };
        }
      }
    }
  }

  return { updatePosition: true, reason: "ok" };
}
