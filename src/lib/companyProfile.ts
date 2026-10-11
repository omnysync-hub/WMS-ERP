export interface CompanyProfile {
  id?: string;
  legalName: string;
  tradeName: string;
  addressText: string;
  phone: string;
  email: string;
  ntnNumber: string;
  strnNumber: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  isSetupCompleted: boolean;
  goLiveDate?: string | null;
}

export const EMPTY_COMPANY_PROFILE: CompanyProfile = {
  legalName: "",
  tradeName: "",
  addressText: "",
  phone: "",
  email: "",
  ntnNumber: "",
  strnNumber: "",
  baseCurrency: "PKR",
  fiscalYearStartMonth: 7,
  isSetupCompleted: false,
  goLiveDate: null,
};

type CompanyProfileInput = Partial<
  Omit<CompanyProfile, "goLiveDate" | "tradeName" | "ntnNumber" | "strnNumber">
> & {
  tradeName?: string | null;
  ntnNumber?: string | null;
  strnNumber?: string | null;
  goLiveDate?: string | Date | null;
};

export function normalizeCompanyProfile(value: CompanyProfileInput | null | undefined): CompanyProfile {
  return {
    ...EMPTY_COMPANY_PROFILE,
    ...value,
    legalName: value?.legalName?.trim() || "",
    tradeName: value?.tradeName?.trim() || "",
    addressText: value?.addressText?.trim() || "",
    phone: value?.phone?.trim() || "",
    email: value?.email?.trim() || "",
    ntnNumber: value?.ntnNumber?.trim() || "",
    strnNumber: value?.strnNumber?.trim() || "",
    baseCurrency: value?.baseCurrency?.trim() || "PKR",
    fiscalYearStartMonth: Number(value?.fiscalYearStartMonth) || 7,
    isSetupCompleted: Boolean(value?.isSetupCompleted),
    goLiveDate: value?.goLiveDate instanceof Date ? value.goLiveDate.toISOString() : value?.goLiveDate || null,
  };
}

export function getCompanyDisplayName(profile: Partial<CompanyProfile> | null | undefined): string {
  return profile?.tradeName?.trim() || profile?.legalName?.trim() || "Company";
}

export function getCompanyLegalName(profile: Partial<CompanyProfile> | null | undefined): string {
  return profile?.legalName?.trim() || profile?.tradeName?.trim() || "Company";
}

export function getCompanyContactLine(profile: Partial<CompanyProfile> | null | undefined): string {
  return [profile?.addressText?.trim(), profile?.phone?.trim() ? `Phone: ${profile.phone.trim()}` : ""]
    .filter(Boolean)
    .join(" • ");
}

export function getCompanyTaxLine(profile: Partial<CompanyProfile> | null | undefined, suffix?: string): string {
  return [
    profile?.ntnNumber?.trim() ? `NTN: ${profile.ntnNumber.trim()}` : "",
    profile?.strnNumber?.trim() ? `STRN: ${profile.strnNumber.trim()}` : "",
    suffix?.trim() || "",
  ]
    .filter(Boolean)
    .join(" • ");
}
