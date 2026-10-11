"use client";

import { Flame } from "lucide-react";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { getCompanyContactLine, getCompanyTaxLine } from "@/lib/companyProfile";

interface CompanyLetterheadProps {
  qualifier?: string;
}

export default function CompanyLetterhead({ qualifier }: CompanyLetterheadProps) {
  const { profile, legalName } = useCompanyProfile();
  const contactLine = getCompanyContactLine(profile);
  const taxLine = getCompanyTaxLine(profile, qualifier);

  return (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-[#0D7A5F] text-white flex items-center justify-center shadow">
        <Flame className="w-7 h-7" />
      </div>
      <div>
        <h1 className="text-lg font-black tracking-tight text-zinc-900 leading-none uppercase">{legalName}</h1>
        {profile.email && <p className="text-[11px] text-zinc-600 font-medium mt-0.5">{profile.email}</p>}
        {contactLine && <div className="text-[10px] text-zinc-500 font-mono mt-1">{contactLine}</div>}
        {taxLine && <div className="text-[10px] text-zinc-500 font-mono">{taxLine}</div>}
      </div>
    </div>
  );
}
