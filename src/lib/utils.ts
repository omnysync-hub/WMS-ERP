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
  
  // Clean up common programmatic encodings and all underscores
  let formatted = type
    .replace(/___/g, " & ")
    .replace(/__/g, " - ")
    .replace(/_+/g, " ")
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
    .split(/\s+/)
    .map((w) => {
      const lower = w.toLowerCase().replace(/[^a-z]/g, "");
      if (lower === "repa") return "Repair";
      if (acronyms[lower]) {
        return acronyms[lower];
      }
      if (w === "&" || w === "-") return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function numberToWords(num: number): string {
  if (!num || isNaN(num) || num <= 0) return "Zero";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
    if (n < 1000)
      return (
        a[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 !== 0 ? " and " + inWords(n % 100) : "")
      );
    if (n < 100000)
      return (
        inWords(Math.floor(n / 1000)) +
        " Thousand" +
        (n % 1000 !== 0 ? " " + inWords(n % 1000) : "")
      );
    if (n < 10000000)
      return (
        inWords(Math.floor(n / 100000)) +
        " Lakh" +
        (n % 100000 !== 0 ? " " + inWords(n % 100000) : "")
      );
    return (
      inWords(Math.floor(n / 10000000)) +
      " Crore" +
      (n % 10000000 !== 0 ? " " + inWords(n % 10000000) : "")
    );
  }

  const rounded = Math.round(num);
  return inWords(rounded).trim() + " Rupees Only";
}

/**
 * Determines whether a job line item is a Service (labor, commissioning, visit)
 * versus a physical Stock / Material item.
 */
export function isServiceItem(item: any): boolean {
  if (!item) return false;
  if (item.isService === true) return true;
  const desc = (typeof item === "string" ? item : item.description || "").toLowerCase().trim();
  if (!desc) return false;

  // Explicit service tags and patterns
  if (
    desc.startsWith("[service") ||
    desc.includes("[service]") ||
    desc.includes("[service added by") ||
    desc.includes("service added by") ||
    desc.startsWith("service:")
  ) {
    return true;
  }

  // Explicit product or warehouse issued tags are physical stock
  if (
    desc.startsWith("[product]") ||
    desc.includes("[issued by storekeeper]") ||
    desc.includes("issued by storekeeper") ||
    desc.includes("[issued by")
  ) {
    return false;
  }

  // Common service names & keywords
  if (
    desc.includes("installation & commissioning") ||
    desc.includes("installation and commissioning") ||
    desc.includes("duct cleaning") ||
    desc.includes("gas recharge") ||
    desc.includes("preventive maintenance") ||
    desc.includes("inspection & audit") ||
    desc.includes("audit & inspection") ||
    desc.includes("repair service") ||
    desc.includes("general service") ||
    desc.includes("troubleshooting") ||
    desc.includes("labor") ||
    desc.includes("labour")
  ) {
    return true;
  }

  return false;
}
