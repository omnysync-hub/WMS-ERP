"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileSimulatorModal from "./MobileSimulatorModal";
import AddCustomerDrawer from "@/components/drawers/AddCustomerDrawer";
import ToastViewport from "@/components/ui/ToastViewport";

import { RoleProvider } from "@/contexts/RoleContext";
import { setupGlobalClickTracker, logActivity } from "@/lib/telemetry";
import { realtimeSync, SyncEvent } from "@/lib/realtimeSync";
import { playNotificationAlert } from "@/lib/notificationAudio";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  // Real-Time Event Listener for Audio/TTS Notifications and Toasts
  useEffect(() => {
    const unsub = realtimeSync.subscribe((event: SyncEvent) => {
      if (event.type === "DISCOUNT_REQUESTED") {
        const text = `Attention: New discount request submitted for Work Order ${event.jobNumber || ""}`;
        playNotificationAlert(text, "discount");
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("workman:toast", {
              detail: {
                message: `📢 ${event.message || text}`,
                tone: "info",
                duration: 7000,
              },
            })
          );
        }
      } else if (event.type === "INVENTORY_REQUESTED") {
        const text = `Attention: New warehouse stock request submitted for Work Order ${event.jobNumber || ""}`;
        playNotificationAlert(text, "stock");
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("workman:toast", {
              detail: {
                message: `📦 ${event.message || text}`,
                tone: "info",
                duration: 7000,
              },
            })
          );
        }
      }
    });

    return () => unsub();
  }, []);

  // Global Omni-Click Telemetry Listener
  useEffect(() => {
    const cleanup = setupGlobalClickTracker();
    return () => cleanup();
  }, []);

  // Track Route Navigation
  useEffect(() => {
    if (pathname) {
      setIsMobileNavigationOpen(false);
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

  if (pathname === "/login" || pathname === "/change-password") {
    return <>{children}</>;
  }

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
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[110] -translate-y-20 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#18181B] shadow-xl transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      <div className="min-h-screen bg-[#18181B] p-0 sm:p-2.5 flex overflow-hidden">
        {/* Outer rounded dark frame sitting inside page edge */}
        <div className="flex-1 flex h-screen sm:h-[calc(100vh-1.25rem)] sm:rounded-2xl overflow-hidden bg-[#18181B] border-0 sm:border border-[#27272A]/40 relative">
          {/* Continuous Dark Left Sidebar */}
          <div className="hidden lg:block h-full">
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={handleToggleSidebar}
              onOpenMobileSim={handleOpenMobileSimInNewTab}
            />
          </div>

          {isMobileNavigationOpen && (
            <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
              <button
                type="button"
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
                onClick={() => setIsMobileNavigationOpen(false)}
                aria-label="Close navigation menu"
              />
              <div className="relative h-full shadow-2xl animate-in slide-in-from-left duration-200">
                <Sidebar
                  isCollapsed={false}
                  onToggleCollapse={() => setIsMobileNavigationOpen(false)}
                  onOpenMobileSim={handleOpenMobileSimInNewTab}
                />
              </div>
            </div>
          )}

          {/* Right Column: Continuous Dark Topbar + Inset Rounded Content Area */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            {/* Continuous Dark Topbar (exact same background color, no visible seam) */}
            <Topbar
              onOpenNavigation={() => setIsMobileNavigationOpen(true)}
              onOpenCustomerDrawer={() => setIsAddCustomerOpen(true)}
            />

            {/* Inset White/Light Content Area (Floating rounded-rectangle-within-a-frame) */}
            <main
              id="main-content"
              tabIndex={-1}
              className="flex-1 bg-[#F7F7F8] lg:rounded-tl-2xl overflow-y-auto p-3.5 sm:p-5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] focus:outline-none"
            >
              <div className="w-full max-w-[1920px] mx-auto">
                {children}
              </div>
            </main>
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
        <ToastViewport />
      </div>
    </RoleProvider>
  );
}
