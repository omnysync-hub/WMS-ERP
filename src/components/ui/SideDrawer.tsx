"use client";

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  className?: string;
  bodyClassName?: string;
  customHeader?: React.ReactNode;
}

export default function SideDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "max-w-lg",
  className,
  bodyClassName,
  customHeader,
}: SideDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  // Animation state machine: isMounted keeps it in DOM during exit animation; isVisible triggers CSS transitions
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let animFrame: number;
    let timer: ReturnType<typeof setTimeout>;

    if (isOpen) {
      setIsMounted(true);
      previouslyFocusedElement.current = document.activeElement as HTMLElement;

      // Small tick allows initial un-animated styles (opacity-0, translate-x-full) to paint before animating
      animFrame = requestAnimationFrame(() => {
        timer = setTimeout(() => {
          setIsVisible(true);
        }, 15);
      });

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        cancelAnimationFrame(animFrame);
        clearTimeout(timer);
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      setIsVisible(false);
      // Wait for exit transition (300ms) to complete before unmounting from DOM
      timer = setTimeout(() => {
        setIsMounted(false);
        if (previouslyFocusedElement.current) {
          previouslyFocusedElement.current.focus();
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isVisible) {
      drawerRef.current?.focus();
    }
  }, [isVisible]);

  if (!isMounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-300 drawer-backdrop",
        isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
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
        className={cn(
          `w-full ${width} bg-white h-full shadow-2xl flex flex-col justify-between border-l border-[#E4E4E7] focus:outline-none transform transition-transform duration-300`,
          isVisible ? "translate-x-0 ease-out" : "translate-x-full ease-in",
          className
        )}
      >
        {/* Header */}
        {customHeader ? (
          customHeader
        ) : (
          <div className="px-6 py-4 border-b border-[#E4E4E7] flex items-center justify-between bg-white shrink-0">
            <div>
              {typeof title === "string" ? (
                <h2 id="drawer-title" className="text-sm font-bold text-[#1A1D1F] tracking-tight">
                  {title}
                </h2>
              ) : (
                <div id="drawer-title">{title}</div>
              )}
              {typeof subtitle === "string" ? (
                <p className="text-xs text-[#71717A] mt-0.5">{subtitle}</p>
              ) : (
                subtitle && <div className="text-xs text-[#71717A] mt-0.5">{subtitle}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="p-1.5 rounded-lg text-[#71717A] hover:text-[#1A1D1F] hover:bg-[#F4F4F5] transition focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable Body */}
        <div className={bodyClassName || "flex-1 p-6 overflow-y-auto space-y-4"}>
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
