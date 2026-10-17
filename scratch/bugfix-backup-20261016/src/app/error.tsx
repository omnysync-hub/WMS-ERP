"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application section failed to render", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center p-6">
      <div className="erp-card w-full p-7 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-[#18181B]">This section could not be loaded</h1>
        <p className="mt-2 text-xs leading-relaxed text-[#71717A]">
          Your work is safe. Try loading the section again; if the problem continues, share the reference below with an administrator.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[10px] text-[#A1A1AA]">Reference: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-[#0D7A5F] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0A624C]"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    </div>
  );
}
