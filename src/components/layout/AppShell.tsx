"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileSimulatorModal from "./MobileSimulatorModal";
import AddCustomerDrawer from "@/components/drawers/AddCustomerDrawer";

import { RoleProvider } from "@/contexts/RoleContext";
import { setupGlobalClickTracker, logActivity } from "@/lib/telemetry";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // Global Omni-Click Telemetry Listener
  useEffect(() => {
    const cleanup = setupGlobalClickTracker();
    return () => cleanup();
  }, []);

  // Track Route Navigation
  useEffect(() => {
    if (pathname) {
      logActivity({
        action: "VIEW_PAGE",
        target: `Page visited: ${pathname}`,
        category: "NAVIGATION",
        metadata: { path: pathname },
      });
    }
  }, [pathname]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved !== null) {
        setIsSidebarCollapsed(saved === "true");
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const handleToggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem("sidebar_collapsed", String(next));
    } catch (e) {
      // ignore
    }
  };

  const handleOpenMobileSimInNewTab = () => {
    window.open("/mobile", "_blank", "noopener,noreferrer");
  };

  // If on dedicated mobile route, render mobile layout with RoleProvider
  if (pathname?.startsWith("/mobile")) {
    return (
      <RoleProvider>
        <main className="min-h-screen bg-[#0C0D10]">{children}</main>
      </RoleProvider>
    );
  }

  return (
    <RoleProvider>
      <div className="min-h-screen bg-[#18181B] p-2 sm:p-2.5 flex overflow-hidden">
        {/* Outer rounded dark frame sitting inside page edge */}
        <div className="flex-1 flex h-[calc(100vh-1rem)] sm:h-[calc(100vh-1.25rem)] rounded-2xl overflow-hidden bg-[#18181B] border border-[#27272A]/40 relative">
          {/* Continuous Dark Left Sidebar */}
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
            onOpenMobileSim={handleOpenMobileSimInNewTab}
          />

          {/* Right Column: Continuous Dark Topbar + Inset Rounded Content Area */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            {/* Continuous Dark Topbar (exact same background color, no visible seam) */}
            <Topbar
              onOpenCustomerDrawer={() => setIsAddCustomerOpen(true)}
            />

            {/* Inset White/Light Content Area (Floating rounded-rectangle-within-a-frame) */}
            <div className="flex-1 bg-[#F7F7F8] rounded-tl-2xl overflow-y-auto p-5 sm:p-7 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]">
              <div className="max-w-7xl mx-auto w-full">
                {children}
              </div>
            </div>
          </div>
        </div>

        {/* Global Quick Add Customer Drawer */}
        <AddCustomerDrawer
          isOpen={isAddCustomerOpen}
          onClose={() => setIsAddCustomerOpen(false)}
          onCustomerCreated={(c) => {
            alert(`Customer "${c.name}" added successfully.`);
          }}
        />
      </div>
    </RoleProvider>
  );
}
