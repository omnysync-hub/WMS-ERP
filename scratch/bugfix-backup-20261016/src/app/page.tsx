"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/contexts/RoleContext";

export default function RootPage() {
  const router = useRouter();
  const { activeRole } = useRole();

  useEffect(() => {
    if (activeRole === "admin") {
      router.replace("/dashboards");
    } else if (activeRole === "hr") {
      router.replace("/hrm");
    } else if (activeRole === "storekeeper") {
      router.replace("/inventory");
    } else {
      router.replace("/jobs");
    }
  }, [activeRole, router]);

  return null;
}
