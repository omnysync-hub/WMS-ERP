"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CompanyProfile,
  EMPTY_COMPANY_PROFILE,
  getCompanyDisplayName,
  getCompanyLegalName,
  normalizeCompanyProfile,
} from "@/lib/companyProfile";

let cachedProfile: CompanyProfile | null = null;
let pendingRequest: Promise<CompanyProfile> | null = null;

async function requestCompanyProfile(): Promise<CompanyProfile> {
  if (!pendingRequest) {
    pendingRequest = fetch("/api/company-profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load company profile");
        const data = await response.json();
        cachedProfile = normalizeCompanyProfile(data.profile);
        return cachedProfile;
      })
      .finally(() => {
        pendingRequest = null;
      });
  }
  return pendingRequest;
}

export function invalidateCompanyProfile(profile?: Partial<CompanyProfile>) {
  cachedProfile = profile ? normalizeCompanyProfile(profile) : null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("company-profile-updated", { detail: cachedProfile }));
  }
}

export function useCompanyProfile() {
  const [profile, setProfile] = useState<CompanyProfile>(cachedProfile || EMPTY_COMPANY_PROFILE);
  const [isLoading, setIsLoading] = useState(!cachedProfile);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    cachedProfile = null;
    try {
      const next = await requestCompanyProfile();
      setProfile(next);
      return next;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (cachedProfile) {
      setProfile(cachedProfile);
      setIsLoading(false);
    } else {
      requestCompanyProfile()
        .then((next) => {
          if (active) setProfile(next);
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) setIsLoading(false);
        });
    }

    const handleUpdate = (event: Event) => {
      const next = (event as CustomEvent<CompanyProfile | null>).detail;
      if (next) setProfile(next);
      else void refresh();
    };
    window.addEventListener("company-profile-updated", handleUpdate);
    return () => {
      active = false;
      window.removeEventListener("company-profile-updated", handleUpdate);
    };
  }, [refresh]);

  return {
    profile,
    isLoading,
    displayName: getCompanyDisplayName(profile),
    legalName: getCompanyLegalName(profile),
    refresh,
  };
}
