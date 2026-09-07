"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Plus,
  Download,
  Upload,
  MoreVertical,
  GitFork,
  Network,
} from "lucide-react";

export interface ViewVariant {
  label: string;
  count?: number;
  onClick?: () => void;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  moduleName?: string;
  breadcrumbs?: BreadcrumbItem[];
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  currentView?: string;
  viewVariants?: ViewVariant[];
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: React.ReactNode;
  };
  secondaryActions?: {
    label: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    href?: string;
  }[];
  actions?: React.ReactNode;
  onExport?: () => void;
  onImport?: () => void;
  extraActions?: React.ReactNode;
}

export default function PageHeader({
  moduleName,
  breadcrumbs,
  title,
  subtitle,
  badge,
  currentView,
  viewVariants,
  primaryAction,
  secondaryActions,
  actions,
  onExport,
  onImport,
  extraActions,
}: PageHeaderProps) {
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isKebabOpen, setIsKebabOpen] = useState(false);

  const displayTitle = title || currentView || moduleName || "Dashboard";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#EDEDED]">
      {/* Breadcrumb / Title with Dropdown Caret */}
      <div className="relative">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-[#71717A] font-normal mb-1">
            <span>Workman</span>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                <span className="text-[#A1A1AA]">/</span>
                {b.href ? (
                  <Link href={b.href} className="hover:text-[#0D7A5F] transition text-[#71717A]">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-[#18181B] font-medium">{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        ) : moduleName ? (
          <div className="flex items-center gap-1.5 text-xs text-[#71717A] font-normal mb-1">
            <span>Workman</span>
            <span className="text-[#A1A1AA]">/</span>
            <span className="text-[#18181B] font-medium">{moduleName}</span>
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          {viewVariants && viewVariants.length > 0 ? (
            <button
              onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
              className="flex items-center gap-1.5 text-lg font-bold text-[#18181B] hover:text-[#0D7A5F] transition focus-visible:ring-2 focus-visible:ring-[#0D7A5F] rounded-md px-1 -ml-1"
              aria-expanded={isViewDropdownOpen}
              aria-haspopup="true"
              aria-label="Toggle view variants dropdown"
            >
              <span>{displayTitle}</span>
              <ChevronDown className="w-4 h-4 text-[#71717A]" />
            </button>
          ) : (
            <h1 className="text-lg font-bold text-[#18181B] tracking-tight">
              {displayTitle}
            </h1>
          )}

          {badge && <div>{badge}</div>}
        </div>

        {subtitle && (
          <p className="text-xs text-[#71717A] mt-0.5 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}

        {/* View Variants Dropdown Menu */}
        {isViewDropdownOpen && viewVariants && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setIsViewDropdownOpen(false)}
            />
            <div className="absolute left-0 top-full mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-[#EDEDED] py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1 text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
                Saved Views
              </div>
              {viewVariants.map((variant, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    variant.onClick?.();
                    setIsViewDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-[#18181B] hover:bg-[#F4F4F5] flex items-center justify-between transition focus-visible:outline-none focus-visible:bg-[#F4F4F5]"
                >
                  <span className="font-medium">{variant.label}</span>
                  {variant.count !== undefined && (
                    <span className="text-[10px] font-mono font-medium px-2 py-0.2 rounded-full bg-[#F4F4F5] text-[#71717A]">
                      {variant.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Action Buttons & Page-Header Utility Icon Cluster */}
      <div className="flex items-center gap-2 shrink-0">
        {actions}

        {secondaryActions?.map((sec, idx) =>
          sec.href ? (
            <Link
              key={idx}
              href={sec.href}
              className="h-8 px-3 rounded-lg border border-[#EDEDED] bg-white hover:bg-[#F7F7F8] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              {sec.icon}
              <span>{sec.label}</span>
            </Link>
          ) : (
            <button
              key={idx}
              type="button"
              onClick={sec.onClick}
              className="h-8 px-3 rounded-lg border border-[#EDEDED] bg-white hover:bg-[#F7F7F8] text-xs font-semibold text-[#18181B] inline-flex items-center gap-1.5 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              {sec.icon}
              <span>{sec.label}</span>
            </button>
          )
        )}

        {onImport && (
          <button
            type="button"
            onClick={onImport}
            aria-label="Import records"
            className="h-8 px-2.5 rounded-lg border border-[#EDEDED] bg-white hover:bg-[#F7F7F8] text-xs font-medium text-[#18181B] inline-flex items-center gap-1.5 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
          >
            <Upload className="w-3.5 h-3.5 text-[#71717A]" />
            <span>Import</span>
          </button>
        )}

        {onExport && (
          <button
            type="button"
            onClick={onExport}
            aria-label="Export records"
            className="h-8 px-2.5 rounded-lg border border-[#EDEDED] bg-white hover:bg-[#F7F7F8] text-xs font-medium text-[#18181B] inline-flex items-center gap-1.5 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
          >
            <Download className="w-3.5 h-3.5 text-[#71717A]" />
            <span>Export</span>
          </button>
        )}

        {extraActions}

        {/* Primary Action Button */}
        {primaryAction && (
          primaryAction.href ? (
            <Link
              href={primaryAction.href}
              className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              {primaryAction.icon || <Plus className="w-3.5 h-3.5" />}
              <span>{primaryAction.label}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="h-8 px-3.5 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-xs font-semibold text-white inline-flex items-center gap-1.5 transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              {primaryAction.icon || <Plus className="w-3.5 h-3.5" />}
              <span>{primaryAction.label}</span>
            </button>
          )
        )}

        {/* Page-Header Utility Icons Cluster (Sitemap & Kebab menu) */}
        <div className="flex items-center gap-1 pl-1 border-l border-[#EDEDED]">
          {/* Hierarchy/Sitemap Icon */}
          <button
            type="button"
            title="View record relationship hierarchy"
            aria-label="View record relationships"
            onClick={() => alert("Relationship Hierarchy Map: Showing links between Work Orders, Technicians, Accounts, and Inventory")}
            className="h-8 w-8 rounded-lg border border-[#EDEDED] bg-white hover:bg-[#F7F7F8] text-[#71717A] hover:text-[#18181B] flex items-center justify-center transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
          >
            <Network className="w-3.5 h-3.5" />
          </button>

          {/* Kebab / Vertical-Dots Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsKebabOpen(!isKebabOpen)}
              title="More actions"
              aria-label="More record actions"
              aria-expanded={isKebabOpen}
              className="h-8 w-8 rounded-lg border border-[#EDEDED] bg-white hover:bg-[#F7F7F8] text-[#71717A] hover:text-[#18181B] flex items-center justify-center transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {isKebabOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsKebabOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-[#EDEDED] rounded-xl shadow-xl w-48 py-1.5 text-xs text-[#18181B] animate-in fade-in zoom-in-95">
                  <button
                    onClick={() => {
                      setIsKebabOpen(false);
                      onExport?.();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] flex items-center gap-2 text-[#71717A] hover:text-[#18181B]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Report CSV</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsKebabOpen(false);
                      window.print();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] flex items-center gap-2 text-[#71717A] hover:text-[#18181B]"
                  >
                    <span>Print View</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
