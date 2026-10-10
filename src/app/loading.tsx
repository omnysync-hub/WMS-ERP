export default function Loading() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading page">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-5 w-44 animate-pulse rounded-md bg-zinc-200" />
          <div className="h-3 w-72 max-w-[70vw] animate-pulse rounded bg-zinc-200/80" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-xl bg-zinc-200" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="erp-card h-24 animate-pulse bg-white p-4">
            <div className="h-3 w-20 rounded bg-zinc-200" />
            <div className="mt-4 h-6 w-24 rounded bg-zinc-200" />
          </div>
        ))}
      </div>
      <div className="erp-card h-72 animate-pulse bg-white p-5">
        <div className="h-4 w-36 rounded bg-zinc-200" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-9 rounded-lg bg-zinc-100" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading application data…</span>
    </div>
  );
}
