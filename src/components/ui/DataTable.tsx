"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Settings2,
  List,
  LayoutGrid,
  Check,
  X,
  User,
  SlidersHorizontal,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  isPrimaryLink?: boolean;
  getHref?: (row: T) => string;
  hasAvatar?: boolean;
  avatarInitials?: (row: T) => string;
  inlineAction?: {
    label: (row: T) => string;
    onClick: (row: T) => void;
  };
}

export interface TabView {
  id: string;
  label: string;
  count?: number;
}

export interface FilterChipOption {
  id: string;
  label: string;
  options: string[];
  selected?: string;
  onSelect?: (option: string) => void;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  tabs?: TabView[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  searchPlaceholder?: string;
  onSearchChange?: (val: string) => void;
  searchValue?: string;
  filterChips?: FilterChipOption[];
  hasAdvancedFiltersActive?: boolean;
  onOpenAdvancedFilters?: () => void;
  bulkActions?: { label: string; onClick: (selectedIds: string[]) => void; icon?: React.ReactNode }[];
  getRowId?: (row: T) => string;
  emptyMessage?: string;
  renderExpandedRow?: (row: T) => React.ReactNode;
  moduleName?: string;
  onRefresh?: () => void;
}

export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  tabs,
  activeTab,
  onTabChange,
  searchPlaceholder = "Filter records...",
  onSearchChange,
  searchValue = "",
  filterChips = [],
  hasAdvancedFiltersActive = false,
  onOpenAdvancedFilters,
  bulkActions,
  getRowId = (row) => row.id || row.jobNumber || String(Math.random()),
  emptyMessage = "There is no data to show in this view. Try adjusting filters.",
  renderExpandedRow,
  moduleName = "records",
  onRefresh,
}: DataTableProps<T>) {
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns.map((c) => c.id));
  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);
  const [activeChipDropdown, setActiveChipDropdown] = useState<string | null>(null);
  const [isViewSelectorOpen, setIsViewSelectorOpen] = useState(false);
  const [currentTableView, setCurrentTableView] = useState("Default Table View");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Selection
  const allSelected = data.length > 0 && selectedRowIds.length === data.length;
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedRowIds(e.target.checked ? data.map((row) => getRowId(row)) : []);
  };

  const handleSelectRow = (id: string) => {
    setSelectedRowIds(
      selectedRowIds.includes(id)
        ? selectedRowIds.filter((item) => item !== id)
        : [...selectedRowIds, id]
    );
  };

  // Row Expand Toggle
  const toggleRowExpand = (id: string) => {
    setExpandedRowIds(
      expandedRowIds.includes(id)
        ? expandedRowIds.filter((item) => item !== id)
        : [...expandedRowIds, id]
    );
  };

  // Toggle column visibility
  const toggleColumn = (colId: string) => {
    if (visibleColumns.includes(colId)) {
      if (visibleColumns.length > 2) {
        setVisibleColumns(visibleColumns.filter((id) => id !== colId));
      }
    } else {
      setVisibleColumns([...visibleColumns, colId]);
    }
  };

  const displayedColumns = columns.filter((col) => visibleColumns.includes(col.id));

  return (
    <div className="space-y-2.5">
      {/* 1. Saved-View Tabs (Under page header) */}
      {tabs && tabs.length > 0 && (
        <div className="flex items-center gap-1 border-b border-[#EDEDED] overflow-x-auto pb-px">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={cn(
                  "px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition border-b-2 -mb-px flex items-center gap-1.5 focus-visible:outline-none",
                  isActive
                    ? "border-[#0D7A5F] text-[#0D7A5F]"
                    : "border-transparent text-[#71717A] hover:text-[#18181B] hover:border-[#D4D4D8]"
                )}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium",
                      isActive
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-[#F4F4F5] text-[#71717A]"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 2. Filter Bar with Individual Chips & Table Top-Right Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-1">
        {/* Left: Search + Individual Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* Search Input */}
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A] pointer-events-none" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="w-full bg-white pl-8 pr-3 py-1.5 rounded-lg text-xs text-[#18181B] border border-[#EDEDED] focus:border-[#0D7A5F] focus:outline-none shadow-2xs placeholder-[#71717A]"
            />
          </div>

          {/* Individual Field Filter Chips ("Deal owner ▾" style) */}
          {filterChips.map((chip) => {
            const isOpen = activeChipDropdown === chip.id;
            return (
              <div key={chip.id} className="relative">
                <button
                  type="button"
                  onClick={() => setActiveChipDropdown(isOpen ? null : chip.id)}
                  aria-expanded={isOpen}
                  aria-label={`Filter by ${chip.label}`}
                  className={cn(
                    "h-7 px-2.5 rounded-md text-xs font-medium border transition inline-flex items-center gap-1.5 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]",
                    chip.selected
                      ? "bg-emerald-50 border-emerald-300 text-[#0D7A5F] font-semibold"
                      : "bg-white border-[#EDEDED] text-[#71717A] hover:bg-[#F7F7F8] hover:text-[#18181B]"
                  )}
                >
                  <span>{chip.selected ? `${chip.label}: ${chip.selected}` : `${chip.label}`}</span>
                  <ChevronDown className="w-3 h-3 text-[#71717A]" />
                </button>

                {isOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setActiveChipDropdown(null)}
                    />
                    <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-[#EDEDED] rounded-xl shadow-xl w-48 py-1.5 text-xs text-[#18181B] animate-in fade-in zoom-in-95">
                      <div className="px-3 py-1 text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
                        Filter: {chip.label}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          chip.onSelect?.("");
                          setActiveChipDropdown(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] text-[#71717A] italic"
                      >
                        All / Clear
                      </button>
                      {chip.options.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            chip.onSelect?.(opt);
                            setActiveChipDropdown(null);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] flex items-center justify-between",
                            chip.selected === opt && "font-bold text-[#0D7A5F] bg-emerald-50/50"
                          )}
                        >
                          <span>{opt}</span>
                          {chip.selected === opt && <Check className="w-3 h-3 text-[#0D7A5F]" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Add Filter Chip Button (+) */}
          <button
            type="button"
            title="Add filter chip"
            aria-label="Add filter chip"
            onClick={() => alert("Select additional filter chip: Priority, Problem Code, or City Zone")}
            className="h-7 w-7 rounded-md border border-[#EDEDED] bg-white text-[#71717A] hover:text-[#18181B] hover:bg-[#F7F7F8] flex items-center justify-center transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Edit Chip Set Button (Pencil) */}
          <button
            type="button"
            title="Edit filter chips layout"
            aria-label="Edit filter chips"
            onClick={() => alert("Customize visible filter chips")}
            className="h-7 w-7 rounded-md border border-[#EDEDED] bg-white text-[#71717A] hover:text-[#18181B] hover:bg-[#F7F7F8] flex items-center justify-center transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
          >
            <Pencil className="w-3 h-3" />
          </button>

          {/* Advanced Filters Link with Colored Dot Badge */}
          <button
            type="button"
            onClick={onOpenAdvancedFilters || (() => alert("Advanced Query Builder: Filter by multiple nested criteria"))}
            aria-label="Advanced filters"
            className="text-xs font-semibold text-[#71717A] hover:text-[#18181B] inline-flex items-center gap-1.5 ml-1 py-1 px-1.5 rounded focus-visible:outline-none"
          >
            <span>Advanced filters</span>
            {hasAdvancedFiltersActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#0D7A5F]" />
            )}
          </button>
        </div>

        {/* Right: Table-Level Controls (View Selector, Grid/List Toggles, Column Gear) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* View Selector Dropdown ("Pipeline Stage ▾" style) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsViewSelectorOpen(!isViewSelectorOpen)}
              aria-expanded={isViewSelectorOpen}
              aria-label="Select table configuration"
              className="h-7 px-2.5 rounded-md border border-[#EDEDED] bg-white text-xs font-medium text-[#71717A] hover:text-[#18181B] hover:bg-[#F7F7F8] inline-flex items-center gap-1.5 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              <span>{currentTableView}</span>
              <ChevronDown className="w-3 h-3 text-[#71717A]" />
            </button>

            {isViewSelectorOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsViewSelectorOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-[#EDEDED] rounded-xl shadow-xl w-52 py-1.5 text-xs text-[#18181B] animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1 text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
                    Table Configurations
                  </div>
                  {["Default Table View", "Compact Density", "Financial Reconciliation", "Field Operations"].map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setCurrentTableView(v);
                        setIsViewSelectorOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] flex items-center justify-between",
                        currentTableView === v && "font-bold text-[#0D7A5F]"
                      )}
                    >
                      <span>{v}</span>
                      {currentTableView === v && <Check className="w-3 h-3 text-[#0D7A5F]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Grid / List View Toggle Icon Buttons */}
          <div className="flex items-center rounded-md border border-[#EDEDED] bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              className={cn(
                "p-1 rounded text-[#71717A] hover:text-[#18181B] transition focus-visible:outline-none",
                viewMode === "list" ? "bg-[#F4F4F5] text-[#18181B]" : "hover:bg-[#F7F7F8]"
              )}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              className={cn(
                "p-1 rounded text-[#71717A] hover:text-[#18181B] transition focus-visible:outline-none",
                viewMode === "grid" ? "bg-[#F4F4F5] text-[#18181B]" : "hover:bg-[#F7F7F8]"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              title="Refresh data"
              aria-label="Refresh table data"
              className="h-7 w-7 rounded-md border border-[#EDEDED] bg-white text-[#71717A] hover:text-[#18181B] hover:bg-[#F7F7F8] flex items-center justify-center transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Column Configuration Gear Icon */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsColumnConfigOpen(!isColumnConfigOpen)}
              title="Configure table columns"
              aria-label="Configure columns"
              className="h-7 w-7 rounded-md border border-[#EDEDED] bg-white text-[#71717A] hover:text-[#18181B] hover:bg-[#F7F7F8] flex items-center justify-center transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>

            {isColumnConfigOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsColumnConfigOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-[#EDEDED] rounded-xl shadow-xl w-56 p-2 text-xs text-[#18181B] animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#71717A] border-b border-[#EDEDED] mb-1">
                    Toggle Table Columns
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {columns.map((col) => (
                      <label
                        key={col.id}
                        className="flex items-center gap-2 px-2 py-1 hover:bg-[#F4F4F5] rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns.includes(col.id)}
                          onChange={() => toggleColumn(col.id)}
                          className="w-3.5 h-3.5 rounded text-[#0D7A5F] accent-[#0D7A5F]"
                        />
                        <span>{col.header}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar (When rows are checked) */}
      {selectedRowIds.length > 0 && (
        <div className="p-2.5 bg-[#18181B] text-white rounded-xl shadow-lg flex items-center justify-between text-xs animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2.5 pl-2">
            <span className="font-mono font-bold bg-[#27272A] px-2 py-0.5 rounded text-white text-[11px]">
              {selectedRowIds.length} selected
            </span>
            <span className="text-[#A1A1AA] text-xs">Bulk action on {moduleName}</span>
          </div>

          <div className="flex items-center gap-2">
            {bulkActions?.map((act, i) => (
              <button
                key={i}
                type="button"
                onClick={() => act.onClick(selectedRowIds)}
                className="px-3 py-1 rounded-lg bg-[#27272A] hover:bg-[#3F3F46] text-white text-xs font-semibold transition flex items-center gap-1.5 focus-visible:ring-1 focus-visible:ring-[#0D7A5F]"
              >
                {act.icon}
                <span>{act.label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedRowIds([])}
              className="px-2.5 py-1 text-xs text-[#A1A1AA] hover:text-white"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* 3. Pure White Dense Data Table with Hairline Dividers */}
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.035)] border border-[#EDEDED] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#EDEDED] text-[11px] font-semibold text-[#71717A] uppercase tracking-wider bg-[#FAFAFA]">
                {/* Select All Checkbox */}
                <th className="w-9 py-2.5 px-3 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    aria-label="Select all rows"
                    className="w-3.5 h-3.5 rounded border-[#D4D4D8] text-[#0D7A5F] focus:ring-[#0D7A5F] accent-[#0D7A5F]"
                  />
                </th>

                {/* Expand Chevron Column */}
                <th className="w-7 py-2.5 px-1 text-center" aria-label="Expand chevron column">
                  <span className="sr-only">Expand</span>
                </th>

                {displayedColumns.map((col) => (
                  <th
                    key={col.id}
                    style={{ width: col.width }}
                    className={cn(
                      "py-2.5 px-3 font-semibold",
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right"
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#EDEDED]">
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={displayedColumns.length + 2}
                    className="py-12 text-center text-xs text-[#71717A]"
                  >
                    <p className="font-medium text-[#18181B]">{emptyMessage}</p>
                    <p className="text-[11px] text-[#A1A1AA] mt-1">
                      No records match the current tab and filter criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const rowId = getRowId(row);
                  const isSelected = selectedRowIds.includes(rowId);
                  const isExpanded = expandedRowIds.includes(rowId);

                  return (
                    <React.Fragment key={rowId}>
                      <tr
                        className={cn(
                          "h-10 hover:bg-[#F9FAFB] transition group",
                          isSelected && "bg-emerald-50/40 hover:bg-emerald-50/60"
                        )}
                      >
                        {/* Row Checkbox */}
                        <td className="w-9 py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectRow(rowId)}
                            aria-label={`Select row ${rowId}`}
                            className="w-3.5 h-3.5 rounded border-[#D4D4D8] text-[#0D7A5F] focus:ring-[#0D7A5F] accent-[#0D7A5F]"
                          />
                        </td>

                        {/* Expand Chevron Button */}
                        <td className="w-7 py-2 px-1 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRowExpand(rowId)}
                            aria-expanded={isExpanded}
                            aria-label={`Toggle row details for ${rowId}`}
                            className="p-1 rounded text-[#A1A1AA] hover:text-[#18181B] hover:bg-[#F4F4F5] transition focus-visible:outline-none"
                          >
                            <ChevronRight
                              className={cn(
                                "w-3.5 h-3.5 transition-transform duration-150",
                                isExpanded && "rotate-90 text-[#0D7A5F]"
                              )}
                            />
                          </button>
                        </td>

                        {/* Data Columns */}
                        {displayedColumns.map((col) => {
                          const value = col.accessorKey ? row[col.accessorKey] : undefined;

                          return (
                            <td
                              key={col.id}
                              className={cn(
                                "py-2 px-3",
                                col.align === "center" && "text-center",
                                col.align === "right" && "text-right"
                              )}
                            >
                              {col.isPrimaryLink ? (
                                <Link
                                  href={col.getHref ? col.getHref(row) : `#`}
                                  className="font-semibold text-[#0D7A5F] hover:underline focus-visible:outline-none"
                                >
                                  {col.cell ? col.cell(row) : value}
                                </Link>
                              ) : col.hasAvatar ? (
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-emerald-50 text-[#0D7A5F] text-[10px] font-bold inline-flex items-center justify-center shrink-0 border border-emerald-200">
                                    {col.avatarInitials
                                      ? col.avatarInitials(row)
                                      : String(value || "T")
                                          .split(" ")
                                          .map((n) => n[0])
                                          .join("")
                                          .slice(0, 2)}
                                  </span>
                                  <span className="font-medium text-[#18181B]">
                                    {col.cell ? col.cell(row) : value}
                                  </span>
                                </div>
                              ) : col.inlineAction ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    col.inlineAction?.onClick(row);
                                  }}
                                  aria-label={`Action: ${col.inlineAction.label(row)}`}
                                  className="font-bold text-[11px] text-[#18181B] hover:text-[#0D7A5F] inline-flex items-center gap-1 py-0.5 px-1.5 rounded hover:bg-[#F4F4F5] transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0D7A5F]"
                                >
                                  <span>{col.inlineAction.label(row)}</span>
                                  <ChevronDown className="w-3 h-3 text-[#71717A]" />
                                </button>
                              ) : col.cell ? (
                                col.cell(row)
                              ) : (
                                <span className="text-[#27272A]">{value ?? "—"}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Expandable Sub-Details Inline Preview */}
                      {isExpanded && (
                        <tr className="bg-[#FAFAFA]">
                          <td colSpan={displayedColumns.length + 2} className="px-10 py-3 border-b border-[#EDEDED]">
                            {renderExpandedRow ? (
                              renderExpandedRow(row)
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#52525B]">
                                <div>
                                  <span className="font-semibold text-[#71717A] text-[10px] uppercase block">
                                    Quick Address / Site
                                  </span>
                                  <span>{row.customer?.addressText || row.addressText || "Physical site address verified on GPS"}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-[#71717A] text-[10px] uppercase block">
                                    Diagnostic Notes / Remarks
                                  </span>
                                  <span>{row.remarks || row.notes || "Standard preventive maintenance checklist"}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-[#71717A] text-[10px] uppercase block">
                                    Assigned Field Technician
                                  </span>
                                  <span>{row.assignedTechnician?.name || row.technician?.name || "Unassigned"}</span>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Record Counts */}
        <div className="px-4 py-2.5 bg-[#FAFAFA] border-t border-[#EDEDED] flex items-center justify-between text-xs text-[#71717A]">
          <span>
            Showing <strong className="text-[#18181B] font-mono">{data.length}</strong> {moduleName}
          </span>
          <span className="text-[11px] font-mono text-[#A1A1AA]">
            15–20 rows/screen standard density
          </span>
        </div>
      </div>
    </div>
  );
}
