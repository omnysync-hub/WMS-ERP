import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "PKR 0";
  const rounded = Math.round(Number(amount));
  return `PKR ${rounded.toLocaleString("en-PK")}`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function capitalizeWords(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function formatJobType(type: string | null | undefined): string {
  if (!type) return "General Service";
  
  // Clean up common programmatic encodings
  let formatted = type
    .replace(/___/g, " & ")
    .replace(/__/g, " - ")
    .replace(/_/g, " ")
    .trim();

  // Acronym and casing map
  const acronyms: Record<string, string> = {
    ac: "AC",
    amc: "(AMC)",
    ahu: "AHU",
    fcu: "FCU",
    vrf: "VRF",
    gps: "GPS",
    hvac: "HVAC",
  };

  return formatted
    .split(" ")
    .map((w) => {
      const lower = w.toLowerCase().replace(/[^a-z]/g, "");
      if (acronyms[lower]) {
        return w.toLowerCase() === lower ? acronyms[lower] : w;
      }
      if (w === "&" || w === "-") return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}
