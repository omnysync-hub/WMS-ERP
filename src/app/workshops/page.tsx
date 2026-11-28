"use client";

import React from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { Gauge, ArrowRight, ClipboardList, Wrench, Recycle, Smartphone } from "lucide-react";

/**
 * Workshops — section landing page.
 *
 * Web review surfaces for the workshop operation live under this section
 * (currently: Bike Meter Readings). The day-to-day workshop work itself —
 * Bikes and HVAC job cards, material requisitions, tool issue/return and
 * scrap recording — runs in the Bikes and HVAC mobile apps against
 * /api/workshops/*, gated by the per-app HR mobile-access toggles; there is
 * no web job-card screen yet, so those are listed here for orientation only.
 */

const WEB_SURFACES = [
  {
    href: "/workshops/meter-readings",
    icon: <Gauge className="w-5 h-5" />,
    title: "Bike Meter Readings",
    description:
      "Manager review of the daily fleet-bike fuel-meter readings (morning start + afternoon return, with photos) submitted by riders from the Bikes app. Flags bikes with a missing reading and shows the day's distance per bike.",
  },
];

const MOBILE_SURFACES = [
  {
    icon: <ClipboardList className="w-5 h-5" />,
    title: "Workshop Job Cards",
    description:
      "Bikes and HVAC job cards (create, diagnose, manager approval, material issue, completion, close) run in the workshop mobile apps under the Job Card SOP.",
  },
  {
    icon: <Wrench className="w-5 h-5" />,
    title: "Tools & Equipment",
    description:
      "Tool issue/return is recorded in the workshop apps. The warehouse tool-crib register for heavy equipment also lives under Warehouse & Stock → Branches & Movements → Tool-Crib.",
  },
  {
    icon: <Recycle className="w-5 h-5" />,
    title: "Scrap Register",
    description:
      "Scrap recording and disposal/sale from workshop jobs is handled in the workshop mobile apps; scrap sales post to the POS cash account in the GL.",
  },
];

export default function WorkshopsPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        moduleName="Workshops"
        title="Workshops"
        subtitle="Bikes and HVAC workshop operations — web review surfaces, plus where each workshop workflow lives."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {WEB_SURFACES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-5 hover:border-[#0D7A5F]/50 transition flex flex-col gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-[#0D7A5F]/10 text-[#0D7A5F] flex items-center justify-center">
              {s.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-1.5">
                {s.title}
                <ArrowRight className="w-3.5 h-3.5 text-[#0D7A5F] opacity-0 group-hover:opacity-100 transition" />
              </h3>
              <p className="text-xs text-[#71717A] mt-1 leading-relaxed">{s.description}</p>
            </div>
          </Link>
        ))}

        {MOBILE_SURFACES.map((s) => (
          <div
            key={s.title}
            className="bg-white rounded-xl border border-[#E4E4E7] shadow-xs p-5 flex flex-col gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-zinc-100 text-zinc-600 flex items-center justify-center">
              {s.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-1.5">
                {s.title}
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500 bg-zinc-100 border border-zinc-200 rounded-full px-2 py-0.5">
                  <Smartphone className="w-3 h-3" /> Mobile app
                </span>
              </h3>
              <p className="text-xs text-[#71717A] mt-1 leading-relaxed">{s.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
