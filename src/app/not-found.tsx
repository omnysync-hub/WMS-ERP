import Link from "next/link";
import { ArrowLeft, LayoutDashboard } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center p-6">
      <div className="erp-card w-full p-7 text-center">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#0D7A5F]">404</p>
        <h1 className="mt-2 text-lg font-bold text-[#18181B]">That section does not exist</h1>
        <p className="mt-2 text-xs leading-relaxed text-[#71717A]">
          The link may be outdated, or your role may use a different workflow. Return to work orders to continue.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/jobs"
            className="flex items-center gap-2 rounded-xl bg-[#0D7A5F] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0A624C]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Return to Work Orders
          </Link>
        </div>
      </div>
    </div>
  );
}
