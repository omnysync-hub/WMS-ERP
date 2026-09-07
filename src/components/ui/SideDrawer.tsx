"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export default function SideDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "max-w-lg",
}: SideDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
      // Focus drawer
      drawerRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    } else if (previouslyFocusedElement.current) {
      previouslyFocusedElement.current.focus();
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200 drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={drawerRef}
        tabIndex={-1}
        className={`w-full ${width} bg-white h-full shadow-2xl flex flex-col justify-between border-l border-[#E4E4E7] animate-in slide-in-from-right duration-250 focus:outline-none`}
      >
        {/* Sticky Header */}
        <div className="px-6 py-4 border-b border-[#E4E4E7] flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 id="drawer-title" className="text-sm font-bold text-[#1A1D1F] tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[#71717A] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded-lg text-[#71717A] hover:text-[#1A1D1F] hover:bg-[#F4F4F5] transition focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {children}
        </div>

        {/* Persistent Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[#E4E4E7] bg-[#FAFAFA] shrink-0 flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
