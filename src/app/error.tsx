"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

const RELOAD_FLAG = "erp_chunk_reload_at";

/** A page's JavaScript file failed to download (flaky network, or the app was rebuilt while the tab was open). */
function isChunkLoadError(error: unknown) {
  const e = error as { name?: string; message?: string } | null;
  const text = `${e?.name || ""} ${e?.message || ""}`;
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(text);
}

function reportClientError(error: Error & { digest?: string }, extra: Record<string, unknown> = {}) {
  try {
    const body = JSON.stringify({
      message: String(error?.message || error).slice(0, 2000),
      name: error?.name,
      digest: error?.digest,
      stack: String(error?.stack || "").slice(0, 4000),
      url: typeof window !== "undefined" ? window.location.href : "",
      ...extra,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/client-errors", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/client-errors", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    // never let error reporting break the error screen
  }
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    console.error("Application section failed to render", error);
    let willReload = false;
    if (chunkError) {
      // Reload the page once to fetch the current files. Guarded so a persistent failure cannot loop.
      try {
        const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
        if (!last || Date.now() - last > 60_000) {
          sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
          willReload = true;
        }
      } catch {
        willReload = false;
      }
    }
    reportClientError(error, { chunkError, autoReload: willReload });
    if (willReload) window.location.reload();
  }, [error, chunkError]);

  const retry = () => {
    // A failed download is not fixed by re-rendering; load the page again instead.
    if (chunkError) window.location.reload();
    else reset();
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center p-6">
      <div className="erp-card w-full p-7 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-[#18181B]">This section could not be loaded</h1>
        <p className="mt-2 text-xs leading-relaxed text-[#71717A]">
          {chunkError
            ? "Part of the page did not download (the connection dropped or the system was just updated). Your work is safe; reloading usually fixes it."
            : "Your work is safe. Try loading the section again; if the problem continues, share the reference below with an administrator."}
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[10px] text-[#A1A1AA]">Reference: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={retry}
          className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-[#0D7A5F] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0A624C]"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          {chunkError ? "Reload page" : "Try again"}
        </button>
      </div>
    </div>
  );
}
