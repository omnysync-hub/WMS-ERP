"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
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
  options: (string | { label: string; value: string })[];
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
  pageSize?: number;
  tableClassName?: string;
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
  pageSize: initialPageSize = 20,
  tableClassName,
}: DataTableProps<T>) {
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns.map((c) => c.id));
  const [isColumnConfigOpen, setIsColumnConfigOpen] = useState(false);
  const [activeChipDropdown, setActiveChipDropdown] = useState<string | null>(null);
  const [chipSearchQuery, setChipSearchQuery] = useState("");
  const [isViewSelectorOpen, setIsViewSelectorOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Reset page when tab, search, or data size changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchValue, data.length]);

  // Sort most recent records on top
  const sortedData = React.useMemo(() => {
    return [...data].sort((a: any, b: any) => {
      const parseDate = (item: any) => {
        const val =
          item?.createdAt ||
          item?.created_at ||
          item?.updatedAt ||
          item?.updated_at ||
          item?.date ||
          item?.jobDate ||
          item?.timestamp;
        if (!val) return 0;
        const d = new Date(val).getTime();
        return isNaN(d) ? 0 : d;
      };
      const dateA = parseDate(a);
      const dateB = parseDate(b);
      if (dateA && dateB && dateA !== dateB) {
        return dateB - dateA;
      }
      return 0;
    });
  }, [data]);

  const totalItems = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedRows = sortedData.slice(startIndex, endIndex);

  // Selection
  const allSelected =
    paginatedRows.length > 0 &&
    paginatedRows.every((row) => selectedRowIds.includes(getRowId(row)));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pageIds = paginatedRows.map((row) => getRowId(row));
    if (e.target.checked) {
      setSelectedRowIds(Array.from(new Set([...selectedRowIds, ...pageIds])));
    } else {
      setSelectedRowIds(selectedRowIds.filter((id) => !pageIds.includes(id)));
    }
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
            const normalizedOptions = chip.options.map((opt) =>
              typeof opt === "string" ? { label: opt, value: opt } : opt
            );
            const selectedMatch = normalizedOptions.find((o) => o.value === chip.selected);
            const displaySelectedLabel = selectedMatch ? selectedMatch.label : chip.selected;

            const q = chipSearchQuery.toLowerCase().trim();
            const filteredOptions = (q && isOpen)
              ? normalizedOptions.filter((opt) => opt.label.toLowerCase().includes(q) || String(opt.value).toLowerCase().includes(q))
              : normalizedOptions;

            return (
              <div key={chip.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setActiveChipDropdown(isOpen ? null : chip.id);
                    setChipSearchQuery("");
                  }}
                  aria-expanded={isOpen}
                  aria-label={`Filter by ${chip.label}`}
                  className={cn(
                    "h-7 px-2.5 rounded-md text-xs font-medium border transition inline-flex items-center gap-1.5 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]",
                    chip.selected && chip.selected !== "all"
                      ? "bg-emerald-50 border-emerald-300 text-[#0D7A5F] font-semibold"
                      : "bg-white border-[#EDEDED] text-[#71717A] hover:bg-[#F7F7F8] hover:text-[#18181B]"
                  )}
                >
                  <span className="truncate max-w-[200px]">{chip.selected && chip.selected !== "all" ? `${chip.label}: ${displaySelectedLabel}` : `${chip.label}`}</span>
                  <ChevronDown className="w-3 h-3 text-[#71717A] shrink-0" />
                </button>

                {isOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => {
                        setActiveChipDropdown(null);
                        setChipSearchQuery("");
                      }}
                    />
                    <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-[#EDEDED] rounded-xl shadow-xl w-60 py-1.5 text-xs text-[#18181B] animate-in fade-in zoom-in-95 flex flex-col">
                      <div className="px-3 py-1 flex items-center justify-between text-[10px] font-bold text-[#71717A] uppercase tracking-wider border-b border-[#F4F4F5] mb-1">
                        <span>Filter: {chip.label}</span>
                        {chip.selected && chip.selected !== "all" && (
                          <button
                            type="button"
                            onClick={() => {
                              chip.onSelect?.("");
                              setActiveChipDropdown(null);
                              setChipSearchQuery("");
                            }}
                            className="text-[#0D7A5F] hover:underline normal-case text-[10px] font-semibold"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      {/* Search box inside filter dropdown if options > 5 */}
                      {normalizedOptions.length > 5 && (
                        <div className="px-2 pb-1.5 pt-0.5">
                          <div className="relative">
                            <Search className="w-3 h-3 text-[#A1A1AA] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              placeholder={`Search ${chip.label}...`}
                              value={chipSearchQuery}
                              onChange={(e) => setChipSearchQuery(e.target.value)}
                              autoFocus
                              className="w-full pl-6 pr-2 py-1 bg-[#F9FAFB] hover:bg-white focus:bg-white border border-[#EDEDED] focus:border-[#0D7A5F] rounded-md text-[11px] text-[#18181B] placeholder-[#A1A1AA] focus:outline-none transition shadow-2xs"
                            />
                          </div>
                        </div>
                      )}

                      <div className="max-h-60 overflow-y-auto divide-y divide-[#F4F4F5]">
                        <button
                          type="button"
                          onClick={() => {
                            chip.onSelect?.("");
                            setActiveChipDropdown(null);
                            setChipSearchQuery("");
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] text-[#71717A] italic"
                        >
                          All / Clear
                        </button>
                        {filteredOptions.length === 0 ? (
                          <div className="px-3 py-2 text-center text-[11px] text-[#A1A1AA]">
                            No matches found
                          </div>
                        ) : (
                          filteredOptions.map((opt, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                chip.onSelect?.(opt.value);
                                setActiveChipDropdown(null);
                                setChipSearchQuery("");
                              }}
                              className={cn(
                                "w-full text-left px-3 py-1.5 hover:bg-[#F4F4F5] flex items-center justify-between transition",
                                chip.selected === opt.value && "font-bold text-[#0D7A5F] bg-emerald-50/50"
                              )}
                            >
                              <span className="truncate pr-2">{opt.label}</span>
                              {chip.selected === opt.value && <Check className="w-3 h-3 text-[#0D7A5F] shrink-0" />}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Quick Clear All Filters button when any filter is active */}
          {filterChips.some((c) => !!c.selected && c.selected !== "all") && (
            <button
              type="button"
              onClick={() => {
                filterChips.forEach((c) => c.onSelect?.(""));
              }}
              className="h-7 px-2.5 rounded-md text-xs text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F4F5] border border-dashed border-[#D4D4D8] transition inline-flex items-center gap-1 font-semibold shadow-2xs"
              title="Reset all active filters"
            >
              <X className="w-3 h-3" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        {/* Right: Table-Level Controls (View Selector, Grid/List Toggles, Column Gear) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* View Selector Dropdown: Table View & Card View */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsViewSelectorOpen(!isViewSelectorOpen)}
              aria-expanded={isViewSelectorOpen}
              aria-label="Select view mode"
              className="h-7 px-2.5 rounded-md border border-[#EDEDED] bg-white text-xs font-medium text-[#71717A] hover:text-[#18181B] hover:bg-[#F7F7F8] inline-flex items-center gap-1.5 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A5F]"
            >
              {viewMode === "table" ? (
                <List className="w-3.5 h-3.5 text-[#0D7A5F]" />
              ) : (
                <LayoutGrid className="w-3.5 h-3.5 text-[#0D7A5F]" />
              )}
              <span className="font-semibold text-[#18181B]">
                {viewMode === "table" ? "Table View" : "Card View"}
              </span>
              <ChevronDown className="w-3 h-3 text-[#71717A]" />
            </button>

            {isViewSelectorOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsViewSelectorOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-[#EDEDED] rounded-xl shadow-xl w-48 py-1.5 text-xs text-[#18181B] animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1 text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
                    View Modes
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("table");
                      setIsViewSelectorOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 hover:bg-[#F4F4F5] flex items-center justify-between transition",
                      viewMode === "table" && "font-bold text-[#0D7A5F] bg-emerald-50/50"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <List className="w-3.5 h-3.5 text-[#71717A]" />
                      <span>Table View</span>
                    </span>
                    {viewMode === "table" && <Check className="w-3.5 h-3.5 text-[#0D7A5F]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("card");
                      setIsViewSelectorOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 hover:bg-[#F4F4F5] flex items-center justify-between transition",
                      viewMode === "card" && "font-bold text-[#0D7A5F] bg-emerald-50/50"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <LayoutGrid className="w-3.5 h-3.5 text-[#71717A]" />
                      <span>Card View</span>
                    </span>
                    {viewMode === "card" && <Check className="w-3.5 h-3.5 text-[#0D7A5F]" />}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Table / Card View Toggle Icon Buttons */}
          <div className="flex items-center rounded-md border border-[#EDEDED] bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              aria-label="Table view"
              title="Table View"
              className={cn(
                "p-1 rounded text-[#71717A] hover:text-[#18181B] transition focus-visible:outline-none",
                viewMode === "table" ? "bg-[#F4F4F5] text-[#0D7A5F] font-bold" : "hover:bg-[#F7F7F8]"
              )}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("card")}
              aria-label="Card view"
              title="Card View"
              className={cn(
                "p-1 rounded text-[#71717A] hover:text-[#18181B] transition focus-visible:outline-none",
                viewMode === "card" ? "bg-[#F4F4F5] text-[#0D7A5F] font-bold" : "hover:bg-[#F7F7F8]"
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

      {/* 3. Pure White Data Table with Hairline Dividers */}
      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.035)] border border-[#EDEDED] overflow-hidden">
        {viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table
              className={cn(
                "w-full min-w-full text-left text-xs border-collapse",
                tableClassName
              )}
            >
              <thead>
                <tr className="border-b border-[#EDEDED] text-xs font-semibold text-[#52525B] uppercase tracking-wider bg-[#FAFAFA]">
                  {/* Select All Checkbox */}
                  <th className="w-10 py-3 px-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      aria-label="Select all rows"
                      className="w-4 h-4 rounded border-[#D4D4D8] text-[#0D7A5F] focus:ring-[#0D7A5F] accent-[#0D7A5F]"
                    />
                  </th>

                  {/* Expand Chevron Column */}
                  <th className="w-8 py-3 px-1 text-center" aria-label="Expand chevron column">
                    <span className="sr-only">Expand</span>
                  </th>

                  {displayedColumns.map((col) => {
                    const isActionCol = col.id === "actions";
                    return (
                      <th
                        key={col.id}
                        style={{ width: col.width }}
                        className={cn(
                          "py-3.5 px-3.5 font-semibold text-xs text-[#52525B]",
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right",
                          isActionCol && "sticky right-0 bg-[#FAFAFA] z-10 shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.06)]"
                        )}
                      >
                        {col.header}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#EDEDED]">
                {totalItems === 0 ? (
                  <tr>
                    <td
                      colSpan={displayedColumns.length + 2}
                      className="py-16 text-center text-xs text-[#71717A]"
                    >
                      <p className="font-semibold text-sm text-[#18181B]">{emptyMessage}</p>
                      <p className="text-xs text-[#A1A1AA] mt-1.5">
                        No records match the current tab and filter criteria.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => {
                    const rowId = getRowId(row);
                    const isSelected = selectedRowIds.includes(rowId);
                    const isExpanded = expandedRowIds.includes(rowId);

                    return (
                      <React.Fragment key={rowId}>
                        <tr
                          className={cn(
                            "hover:bg-[#F9FAFB] transition-colors group",
                            isSelected && "bg-emerald-50/40 hover:bg-emerald-50/60"
                          )}
                        >
                          {/* Row Checkbox */}
                          <td className="w-10 py-3.5 px-3.5 text-center align-middle">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectRow(rowId)}
                              aria-label={`Select row ${rowId}`}
                              className="w-4 h-4 rounded border-[#D4D4D8] text-[#0D7A5F] focus:ring-[#0D7A5F] accent-[#0D7A5F]"
                            />
                          </td>

                          {/* Expand Chevron Button */}
                          <td className="w-8 py-3.5 px-1 text-center align-middle">
                            <button
                              type="button"
                              onClick={() => toggleRowExpand(rowId)}
                              aria-expanded={isExpanded}
                              aria-label={`Toggle row details for ${rowId}`}
                              className="p-1 rounded text-[#A1A1AA] hover:text-[#18181B] hover:bg-[#F4F4F5] transition focus-visible:outline-none"
                            >
                              <ChevronRight
                                className={cn(
                                  "w-4 h-4 transition-transform duration-150",
                                  isExpanded && "rotate-90 text-[#0D7A5F]"
                                )}
                              />
                            </button>
                          </td>

                          {/* Data Columns */}
                          {displayedColumns.map((col) => {
                            const value = col.accessorKey ? row[col.accessorKey] : undefined;
                            const isActionCol = col.id === "actions";

                            return (
                              <td
                                key={col.id}
                                className={cn(
                                  "py-3 px-3.5 align-middle",
                                  col.align === "center" && "text-center",
                                  col.align === "right" && "text-right",
                                  isActionCol && cn(
                                    "sticky right-0 z-10 bg-white group-hover:bg-[#F9FAFB] shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.06)] transition-colors",
                                    isSelected && "bg-[#F0FDF4] group-hover:bg-[#DCFCE7]"
                                  )
                                )}
                              >
                                {col.isPrimaryLink ? (
                                  <Link
                                    href={col.getHref ? col.getHref(row) : `#`}
                                    scroll={false}
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
        ) : (
          <div className="p-3.5 sm:p-5 bg-[#F9FAFB]/70 min-h-[300px]">
            {totalItems === 0 ? (
              <div className="py-16 text-center text-xs text-[#71717A] bg-white rounded-xl border border-[#EDEDED]">
                <p className="font-semibold text-sm text-[#18181B]">{emptyMessage}</p>
                <p className="text-xs text-[#A1A1AA] mt-1.5">
                  No records match the current tab and filter criteria.
                </p>
              </div>
            ) : (
              <>
                {/* Select All on Page Bar in Card View */}
                <div className="flex items-center justify-between pb-3 px-1 text-xs text-[#71717A]">
                  <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-[#18181B] select-none">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      aria-label="Select all cards"
                      className="w-4 h-4 rounded border-[#D4D4D8] text-[#0D7A5F] focus:ring-[#0D7A5F] accent-[#0D7A5F]"
                    />
                    <span>Select all on page</span>
                  </label>
                  <span className="text-[11px] text-[#A1A1AA] font-mono">
                    Showing {totalItems === 0 ? 0 : startIndex + 1}–{endIndex} of {totalItems} {moduleName}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {paginatedRows.map((row) => {
                    const rowId = getRowId(row);
                    const isSelected = selectedRowIds.includes(rowId);
                    const isExpanded = expandedRowIds.includes(rowId);

                    const actionsCol = displayedColumns.find((c) => c.id === "actions");
                    const primaryCol = displayedColumns.find((c) => c.isPrimaryLink) || displayedColumns[0];
                    const statusCol = displayedColumns.find((c) => c.id === "status");
                    const bodyCols = displayedColumns.filter(
                      (c) => c.id !== "actions" && c.id !== primaryCol?.id && c.id !== statusCol?.id
                    );

                    return (
                      <div
                        key={rowId}
                        className={cn(
                          "bg-white rounded-xl border border-[#EDEDED] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.035)] hover:shadow-md transition-all flex flex-col justify-between group",
                          isSelected && "border-[#0D7A5F] bg-emerald-50/15 ring-1 ring-[#0D7A5F]"
                        )}
                      >
                        <div>
                          {/* Card Header: Checkbox, Primary Link / ID, Status */}
                          <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#F4F4F5]">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectRow(rowId)}
                                aria-label={`Select record ${rowId}`}
                                className="w-4 h-4 rounded border-[#D4D4D8] text-[#0D7A5F] focus:ring-[#0D7A5F] accent-[#0D7A5F] shrink-0"
                              />
                              <div className="min-w-0">
                                {primaryCol && (
                                  <div className="font-bold text-xs text-[#18181B] truncate">
                                    {primaryCol.isPrimaryLink ? (
                                      <Link
                                        href={primaryCol.getHref ? primaryCol.getHref(row) : `#`}
                                        scroll={false}
                                        className="font-bold text-[#0D7A5F] hover:underline focus-visible:outline-none"
                                      >
                                        {primaryCol.cell ? primaryCol.cell(row) : (row as any)[primaryCol.id]}
                                      </Link>
                                    ) : primaryCol.cell ? (
                                      primaryCol.cell(row)
                                    ) : (
                                      (row as any)[primaryCol.id]
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            {statusCol && (
                              <div className="shrink-0">
                                {statusCol.cell ? statusCol.cell(row) : (row as any)[statusCol.id]}
                              </div>
                            )}
                          </div>

                          {/* Card Attributes / Columns */}
                          <div className="py-3 space-y-2 text-xs">
                            {bodyCols.map((col) => {
                              const value = col.accessorKey ? (row as any)[col.accessorKey] : undefined;
                              return (
                                <div key={col.id} className="flex items-start justify-between gap-2">
                                  <span className="text-[11px] font-medium text-[#71717A] shrink-0">
                                    {col.header}:
                                  </span>
                                  <div className="text-right text-[11px] text-[#18181B] font-medium break-words max-w-[65%]">
                                    {col.hasAvatar ? (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-50 text-[#0D7A5F] text-[9px] font-bold inline-flex items-center justify-center shrink-0 border border-emerald-200">
                                          {col.avatarInitials
                                            ? col.avatarInitials(row)
                                            : String(value || "T")
                                                .split(" ")
                                                .map((n) => n[0])
                                                .join("")
                                                .slice(0, 2)}
                                        </span>
                                        <span>{col.cell ? col.cell(row) : value}</span>
                                      </div>
                                    ) : col.cell ? (
                                      col.cell(row)
                                    ) : (
                                      <span>{value ?? "—"}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Expandable Preview inside Card */}
                          <div className="pt-2 border-t border-[#F4F4F5]">
                            <button
                              type="button"
                              onClick={() => toggleRowExpand(rowId)}
                              className="text-[11px] font-semibold text-[#71717A] hover:text-[#0D7A5F] inline-flex items-center gap-1 transition"
                            >
                              <ChevronRight
                                className={cn(
                                  "w-3.5 h-3.5 transition-transform duration-150",
                                  isExpanded && "rotate-90 text-[#0D7A5F]"
                                )}
                              />
                              <span>{isExpanded ? "Hide Details" : "View Details"}</span>
                            </button>
                            {isExpanded && (
                              <div className="mt-2 p-2.5 bg-[#F9FAFB] rounded-lg border border-[#EDEDED] text-[11px] space-y-1">
                                {renderExpandedRow ? (
                                  renderExpandedRow(row)
                                ) : (
                                  <div className="space-y-1 text-xs text-[#52525B]">
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
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Actions Footer */}
                        {actionsCol && (
                          <div className="pt-3 border-t border-[#F4F4F5] flex items-center justify-end">
                            {actionsCol.cell ? actionsCol.cell(row) : (row as any)[actionsCol.id]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Table Footer with Pagination Controls */}
        <div className="px-4 py-3 bg-[#FAFAFA] border-t border-[#EDEDED] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#71717A]">
          <div className="flex items-center gap-3">
            <span>
              Showing{" "}
              <strong className="text-[#18181B] font-mono">
                {totalItems === 0 ? 0 : startIndex + 1}–{endIndex}
              </strong>{" "}
              of <strong className="text-[#18181B] font-mono">{totalItems}</strong> {moduleName}
            </span>
            {selectedRowIds.length > 0 && (
              <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                {selectedRowIds.length} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[#71717A]">
              Page <strong className="text-[#18181B]">{validCurrentPage}</strong> of{" "}
              <strong className="text-[#18181B]">{totalPages}</strong>
            </span>

            <div className="inline-flex items-center rounded-lg border border-[#D4D4D8] bg-white shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validCurrentPage <= 1}
                className="px-3 py-1.5 text-xs font-semibold text-[#18181B] hover:bg-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed transition border-r border-[#E4E4E7] flex items-center gap-1 cursor-pointer disabled:pointer-events-none"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validCurrentPage >= totalPages}
                className="px-3 py-1.5 text-xs font-semibold text-[#18181B] hover:bg-[#F4F4F5] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer disabled:pointer-events-none"
                aria-label="Next page"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
