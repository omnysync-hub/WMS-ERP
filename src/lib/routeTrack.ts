/**
 * Route-track math shared by the telemetry history API, the surveillance map
 * and the surveillance timeline — one definition of an honest route, so the
 * distance total, the drawn line and the history events can never disagree.
 *
 * Pure functions only (no Leaflet, no Prisma): safe to import from API routes
 * and client components alike.
 *
 * Honesty rules:
 * - A segment between two consecutive pings is only "track" (real, drawable,
 *   distance-countable movement) when the pings are close in time AND the
 *   implied speed is physically plausible.
 * - A long silence (>= GAP_THRESHOLD_MS — the same 10 minutes that creates an
 *   OfflineGapLog at ingest) makes the segment a "gap": the technician may
 *   have travelled, but we did not observe it, so it is rendered dashed grey
 *   and contributes NO distance.
 * - A segment whose implied speed exceeds MAX_PLAUSIBLE_SPEED_KMH is a "jump"
 *   (GPS teleport / bad fix): also dashed grey, no distance.
 * - A stop is only ever a real cluster of pings staying within
 *   STOP_RADIUS_M for at least STOP_MIN_MS. Nothing is invented.
 * - A ping whose fix is not pinpoint truth — a MOCKED fix, or one whose
 *   accuracy radius is worse than GOOD_FIX_MAX_ACCURACY_M (100 m, shared
 *   with the ingest's position-integrity rules) — proves nothing about
 *   where the technician was: segments touching it are "gap" (dashed, no
 *   distance) and it is excluded from stop detection entirely.
 */

import { GOOD_FIX_MAX_ACCURACY_M, isSloppyAccuracy } from "./locationIntegrity";

export interface TrackPingLike {
  lat: number;
  lng: number;
  /** ISO string, epoch ms or Date — server receipt time of the ping. */
  timestamp: string | number | Date;
  /** Accuracy radius (m) of the fix; null/0 = unknown (cannot be judged). */
  accuracy?: number | null;
  /** OS mock-location flag for the fix. */
  mocked?: boolean;
}

/**
 * True when a ping's fix cannot be trusted as pinpoint truth: mocked, or a
 * known accuracy radius worse than the good-fix bar.
 */
export function isPoorFix(p: TrackPingLike): boolean {
  return p.mocked === true || isSloppyAccuracy(p.accuracy);
}

export { GOOD_FIX_MAX_ACCURACY_M };

export const GAP_THRESHOLD_MS = 10 * 60 * 1000;
export const MAX_PLAUSIBLE_SPEED_KMH = 160;
export const STOP_RADIUS_M = 75;
export const STOP_MIN_MS = 5 * 60 * 1000;
/** GPS drift below this distance is jitter, not movement. */
export const MIN_SEGMENT_KM = 0.005;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type SegmentKind = "track" | "gap" | "jump";

export interface SegmentInfo {
  kind: SegmentKind;
  dtMs: number;
  distKm: number;
  impliedSpeedKmh: number;
}

/** Classify the segment from ping `a` to the next ping `b`. */
export function classifySegment(a: TrackPingLike, b: TrackPingLike): SegmentInfo {
  const ta = new Date(a.timestamp).getTime();
  const tb = new Date(b.timestamp).getTime();
  const dtMs = tb - ta;
  const distKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
  const impliedSpeedKmh = dtMs > 0 ? distKm / (dtMs / 3600000) : distKm > 0 ? Infinity : 0;

  let kind: SegmentKind = "track";
  // A segment anchored on a mocked or sloppy fix is not observed travel:
  // rendered like a gap (dashed grey) and counted as no distance.
  if (isPoorFix(a) || isPoorFix(b)) kind = "gap";
  else if (dtMs >= GAP_THRESHOLD_MS) kind = "gap";
  else if (impliedSpeedKmh > MAX_PLAUSIBLE_SPEED_KMH) kind = "jump";
  return { kind, dtMs, distKm, impliedSpeedKmh };
}

/**
 * Total distance actually observed: only "track" segments count, and only
 * their part above GPS jitter. Gap/jump segments contribute nothing — the
 * movement across them was never observed.
 */
export function trackDistanceKm(pings: TrackPingLike[]): number {
  let total = 0;
  for (let i = 1; i < pings.length; i++) {
    const seg = classifySegment(pings[i - 1], pings[i]);
    if (seg.kind === "track" && seg.distKm >= MIN_SEGMENT_KM) {
      total += seg.distKm;
    }
  }
  return Math.round(total * 100) / 100;
}

export interface StopCluster {
  /** Index of the first ping of the stop. */
  startIndex: number;
  /** Index of the last ping of the stop (the departure is the next ping). */
  endIndex: number;
  lat: number;
  lng: number;
  startTimestamp: string | number | Date;
  endTimestamp: string | number | Date;
  durationMinutes: number;
  pingCount: number;
}

/**
 * Derive stops from real ping clusters: a maximal run of consecutive pings
 * that stay within STOP_RADIUS_M of the run's anchor (first) ping, spanning
 * at least STOP_MIN_MS. Single pings and short pauses are not stops.
 */
export function deriveStops(pings: TrackPingLike[]): StopCluster[] {
  // Mocked / sloppy-accuracy pings are excluded BEFORE clustering: a stop
  // is a claim about where the technician provably stayed, and a ±400 m
  // fix proves no such thing. Reported indices refer to the ORIGINAL array.
  const usable = pings
    .map((ping, index) => ({ ping, index }))
    .filter(({ ping }) => !isPoorFix(ping));

  const stops: StopCluster[] = [];
  let i = 0;
  while (i < usable.length) {
    const anchor = usable[i].ping;
    let j = i;
    while (
      j + 1 < usable.length &&
      haversineKm(anchor.lat, anchor.lng, usable[j + 1].ping.lat, usable[j + 1].ping.lng) *
        1000 <=
        STOP_RADIUS_M
    ) {
      j++;
    }
    if (j > i) {
      const startMs = new Date(usable[i].ping.timestamp).getTime();
      const endMs = new Date(usable[j].ping.timestamp).getTime();
      const durationMs = endMs - startMs;
      if (durationMs >= STOP_MIN_MS) {
        let latSum = 0;
        let lngSum = 0;
        for (let k = i; k <= j; k++) {
          latSum += usable[k].ping.lat;
          lngSum += usable[k].ping.lng;
        }
        const count = j - i + 1;
        stops.push({
          startIndex: usable[i].index,
          endIndex: usable[j].index,
          lat: latSum / count,
          lng: lngSum / count,
          startTimestamp: usable[i].ping.timestamp,
          endTimestamp: usable[j].ping.timestamp,
          durationMinutes: Math.round((durationMs / 60000) * 10) / 10,
          pingCount: count,
        });
      }
      i = j + 1;
    } else {
      i++;
    }
  }
  return stops;
}

/** "Ahmed Raza Khan" → "AR"; single name → its first two letters. */
export function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
