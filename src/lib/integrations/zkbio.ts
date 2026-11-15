import { NextRequest } from "next/server";

/**
 * ZKBio Time integration helpers.
 *
 * Device punches live in their own table (DevicePunch), separate from
 * AttendanceLog — decided 2026-11-16. A poller on the client-office PC
 * pushes punches to the ERP; it authenticates with a shared sync token
 * sent in the `x-zkbio-sync-token` header. The token value lives only
 * in the server environment (ZKBIO_SYNC_TOKEN) and in the poller's
 * local config on the client PC — never in the database or the repo.
 */

export type SyncTokenCheck = "ok" | "not_configured" | "invalid";

export function checkSyncToken(req: NextRequest): SyncTokenCheck {
  const expected = process.env.ZKBIO_SYNC_TOKEN;
  if (!expected) return "not_configured";
  const provided = req.headers.get("x-zkbio-sync-token");
  if (!provided) return "invalid";
  // Length-guard then plain compare; the token is a high-entropy secret
  // and this endpoint is additionally rate-limited by batch size.
  if (provided.length !== expected.length) return "invalid";
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0 ? "ok" : "invalid";
}

/**
 * Map a ZKBio punch to the ERP punch type. The display string is the
 * most reliable signal ("Check In" / "Check Out" / break & overtime
 * variants); the numeric punch_state code is the fallback
 * (ZKTeco convention: 0 = check in, 1 = check out). Everything else
 * is OTHER, with the raw values preserved on the DevicePunch row.
 */
export function mapPunchType(
  rawState: string | null | undefined,
  displayText: string | null | undefined
): "CHECK_IN" | "CHECK_OUT" | "OTHER" {
  const text = (displayText || "").trim().toLowerCase().replace(/[-_]/g, " ");
  if (text === "check in") return "CHECK_IN";
  if (text === "check out") return "CHECK_OUT";
  if (text && !text.startsWith("check")) return "OTHER";
  const code = (rawState ?? "").toString().trim();
  if (code === "0") return "CHECK_IN";
  if (code === "1") return "CHECK_OUT";
  return "OTHER";
}
