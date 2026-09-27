const fs = require("fs");

// Reports sticky
{
  const path = "src/components/procurement/ProcurementReportsTab.tsx";
  let s = fs.readFileSync(path, "utf8");
  const hadCRLF = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  const n = (s.match(/sticky top-0/g) || []).length;
  s = s.replace(
    '<div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">',
    '<div className="sticky top-0 z-20 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#EDEDED] p-3.5 rounded-xl shadow-2xs">'
  );
  // Use PROCUREMENT_THEAD if tables exist without sticky
  if (!s.includes("sticky top-0 z-10") && s.includes("<thead")) {
    s = s.replace(
      /<thead className="([^"]*)"/g,
      (m, cls) => {
        if (cls.includes("sticky")) return m;
        return `<thead className="sticky top-0 z-10 ${cls}"`;
      }
    );
  }
  if (hadCRLF) s = s.replace(/\n/g, "\r\n");
  fs.writeFileSync(path, s);
  console.log("Reports sticky applied, sticky count before:", n);
}

// Quieter secondary tab badges on procurement page — soften chip tones
{
  const path = "src/app/procurement/page.tsx";
  let s = fs.readFileSync(path, "utf8");
  const hadCRLF = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  // Soften metric chip rendering if loud emerald/rose — look for tone classes
  if (!s.includes("secondaryQuiet")) {
    // Add a comment marker and tone map tweak near MetricChip usage
    s = s.replace(
      'tone?: "slate" | "amber" | "red";',
      'tone?: "slate" | "amber" | "red"; // secondary tabs use slate — keep quiet'
    );
  }
  // Soften tab count badges if present like bg-emerald-500 text-white rounded-full
  s = s.replace(/bg-emerald-500 text-white/g, "bg-slate-200 text-slate-600");
  s = s.replace(/bg-rose-500 text-white/g, "bg-slate-200 text-slate-600");
  s = s.replace(/bg-amber-500 text-white/g, "bg-amber-100 text-amber-800");
  if (hadCRLF) s = s.replace(/\n/g, "\r\n");
  fs.writeFileSync(path, s);
  console.log("page badge tones quieted where applicable");
}
