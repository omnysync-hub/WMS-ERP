"use client";

import React, { useState, useRef, useEffect, useId, useMemo } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeTone?: "green" | "blue" | "amber" | "red" | "zinc";
  disabled?: boolean;
}

export interface SearchableSelectProps {
  options: (string | SelectOption)[];
  value?: string | string[];
  onChange: (value: any) => void;
  onMultiChange?: (values: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  required?: boolean;
  className?: string;
  dropdownClassName?: string;
  name?: string;
  id?: string;
  icon?: React.ReactNode;
  showBadgesInTrigger?: boolean;
}

function getBadgeColor(badge?: string, tone?: string) {
  if (tone === "green") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (tone === "blue") return "bg-sky-100 text-sky-800 border-sky-200";
  if (tone === "amber") return "bg-amber-100 text-amber-800 border-amber-200";
  if (tone === "red") return "bg-rose-100 text-rose-800 border-rose-200";
  if (tone === "zinc") return "bg-zinc-100 text-zinc-700 border-zinc-200";

  if (!badge) return "bg-zinc-100 text-zinc-700 border-zinc-200";
  const b = badge.toLowerCase();
  if (b.includes("avail") || b.includes("active") || b.includes("approved")) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (b.includes("job") || b.includes("progress")) {
    return "bg-sky-100 text-sky-800 border-sky-200";
  }
  if (b.includes("assign") || b.includes("pending") || b.includes("draft")) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (b.includes("cancel") || b.includes("reject") || b.includes("off") || b.includes("disputed")) {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  return "bg-zinc-100 text-zinc-700 border-zinc-200";
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  onMultiChange,
  multiple = false,
  placeholder = "-- Select an option --",
  searchPlaceholder = "Type to search...",
  disabled = false,
  clearable = false,
  required = false,
  className,
  dropdownClassName,
  name,
  id,
  icon,
}: SearchableSelectProps) {
  const generatedId = useId();
  const listboxId = `${id || generatedId}-listbox`;
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Normalize options to SelectOption objects
  const normalizedOptions: SelectOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === "string") {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  // Selected values array for multi-select
  const selectedValues: string[] = useMemo(() => {
    if (multiple) {
      if (Array.isArray(value)) return value;
      if (typeof value === "string" && value) return [value];
      return [];
    }
    return typeof value === "string" && value ? [value] : [];
  }, [multiple, value]);

  // Single mode selected option
  const singleSelectedOption = useMemo(() => {
    if (multiple) return null;
    return normalizedOptions.find((opt) => opt.value === value);
  }, [multiple, normalizedOptions, value]);

  // Multi mode selected options list
  const multiSelectedOptions = useMemo(() => {
    if (!multiple) return [];
    return normalizedOptions.filter((opt) => selectedValues.includes(opt.value));
  }, [multiple, normalizedOptions, selectedValues]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const query = searchTerm.toLowerCase().trim();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(query)) ||
        (opt.badge && opt.badge.toLowerCase().includes(query)) ||
        opt.value.toLowerCase().includes(query)
    );
  }, [normalizedOptions, searchTerm]);

  // Handle outside click to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setHighlightedIndex(-1);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 30);
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-option-item]");
      const item = items[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          const opt = filteredOptions[highlightedIndex];
          if (!opt.disabled) {
            handleSelect(opt);
          }
        } else if (filteredOptions.length === 1 && !filteredOptions[0].disabled) {
          handleSelect(filteredOptions[0]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (opt: SelectOption) => {
    if (opt.disabled) return;

    if (multiple) {
      const next = selectedValues.includes(opt.value)
        ? selectedValues.filter((v) => v !== opt.value)
        : [...selectedValues, opt.value];
      onChange(next);
      onMultiChange?.(next);
    } else {
      onChange(opt.value);
      setIsOpen(false);
    }
  };

  const handleRemoveItem = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const next = selectedValues.filter((v) => v !== val);
    onChange(next);
    onMultiChange?.(next);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (multiple) {
      onChange([]);
      onMultiChange?.([]);
    } else {
      onChange("");
    }
  };

  const handleSelectAllFiltered = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !multiple) return;
    const validValues = filteredOptions.filter((o) => !o.disabled).map((o) => o.value);
    const combined = Array.from(new Set([...selectedValues, ...validValues]));
    onChange(combined);
    onMultiChange?.(combined);
  };

  const handleClearAllFiltered = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !multiple) return;
    const filterSet = new Set(filteredOptions.map((o) => o.value));
    const next = selectedValues.filter((v) => !filterSet.has(v));
    onChange(next);
    onMultiChange?.(next);
  };

  const hasSelections = multiple ? selectedValues.length > 0 : Boolean(value);

  return (
    <div
      ref={containerRef}
      className="relative w-full text-left select-none"
      onKeyDown={handleKeyDown}
    >
      {/* Hidden native input for forms and required validation */}
      {name && (
        <input
          type="hidden"
          name={name}
          id={id}
          value={multiple ? selectedValues.join(",") : (value as string) || ""}
          required={required && !hasSelections}
        />
      )}

      {/* Main Trigger Button */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={cn(
          "w-full min-h-[38px] px-3 py-1.5 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] flex items-center justify-between gap-2 cursor-pointer transition focus:bg-white focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] focus:outline-none hover:border-[#D4D4D8]",
          isOpen && "bg-white border-[#0D7A5F] ring-1 ring-[#0D7A5F]",
          disabled && "opacity-50 cursor-not-allowed bg-zinc-100",
          className
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1 flex-wrap">
          {icon && <span className="text-[#71717A] shrink-0">{icon}</span>}

          {multiple ? (
            multiSelectedOptions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                {multiSelectedOptions.map((opt) => (
                  <span
                    key={opt.value}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-[#0D7A5F] border border-emerald-200 px-2 py-0.5 rounded-md transition"
                  >
                    {opt.icon && <span className="scale-75 -ml-0.5 shrink-0">{opt.icon}</span>}
                    <span className="truncate max-w-[150px]">{opt.label}</span>
                    {opt.badge && (
                      <span
                        className={cn(
                          "text-[9px] px-1 py-0 rounded border font-mono shrink-0",
                          getBadgeColor(opt.badge, opt.badgeTone)
                        )}
                      >
                        {opt.badge}
                      </span>
                    )}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={(e) => handleRemoveItem(opt.value, e)}
                        className="hover:bg-emerald-200/60 rounded p-0.5 ml-0.5 text-emerald-800 transition shrink-0"
                        title={`Remove ${opt.label}`}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[#A1A1AA] truncate">{placeholder}</span>
            )
          ) : singleSelectedOption ? (
            <div className="flex items-center gap-2 truncate">
              {singleSelectedOption.icon && (
                <span className="shrink-0">{singleSelectedOption.icon}</span>
              )}
              <span className="font-semibold truncate">{singleSelectedOption.label}</span>
              {singleSelectedOption.subLabel && (
                <span className="text-[10px] text-[#71717A] truncate font-mono">
                  ({singleSelectedOption.subLabel})
                </span>
              )}
              {singleSelectedOption.badge && (
                <span
                  className={cn(
                    "text-[9px] px-1.5 py-0.2 rounded border font-bold uppercase tracking-wider shrink-0",
                    getBadgeColor(singleSelectedOption.badge, singleSelectedOption.badgeTone)
                  )}
                >
                  {singleSelectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[#A1A1AA] truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-[#71717A]">
          {multiple && selectedValues.length > 0 && (
            <span className="text-[10px] font-mono font-bold bg-[#0D7A5F] text-white px-1.5 py-0.5 rounded-full">
              {selectedValues.length}
            </span>
          )}
          {clearable && hasSelections && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 transition"
              title="Clear all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform duration-200 text-[#71717A]",
              isOpen && "rotate-180 text-[#0D7A5F]"
            )}
          />
        </div>
      </div>

      {/* Floating Searchable Popover Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-[#E4E4E7] overflow-hidden animate-in fade-in zoom-in-95 duration-150",
            dropdownClassName
          )}
        >
          {/* Quick Search Header */}
          <div className="p-2 border-b border-[#E4E4E7] bg-[#FAFAFA] space-y-1.5">
            <div className="flex items-center gap-2 px-1">
              <Search className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-xs text-[#18181B] placeholder-[#A1A1AA] outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="p-1 text-zinc-400 hover:text-zinc-700 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick multi-select actions */}
            {multiple && (
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#EDEDED] px-1 text-slate-500">
                <span>
                  {selectedValues.length} of {normalizedOptions.length} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-[#0D7A5F] hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={handleClearAllFiltered}
                    className="text-rose-600 hover:underline font-semibold"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Options List */}
          <div
            id={listboxId}
            ref={listRef}
            role="listbox"
            className="max-h-64 overflow-y-auto p-1.5 space-y-0.5"
          >
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#71717A]">
                <p className="font-semibold text-[#18181B]">No matches found</p>
                <p className="text-[11px] mt-0.5">Try a different search term</p>
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = multiple
                  ? selectedValues.includes(opt.value)
                  : opt.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={opt.value}
                    data-option-item
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition select-none",
                      isSelected
                        ? "bg-emerald-50 text-[#0D7A5F] font-semibold"
                        : isHighlighted
                        ? "bg-[#F4F4F5] text-[#18181B]"
                        : "text-[#18181B] hover:bg-[#F4F4F5]",
                      opt.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                    )}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                      {multiple ? (
                        <div
                          className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition shrink-0",
                            isSelected
                              ? "bg-[#0D7A5F] border-[#0D7A5F] text-white"
                              : "border-zinc-300 bg-white"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      ) : (
                        opt.icon && <span className="shrink-0">{opt.icon}</span>
                      )}

                      {multiple && opt.icon && (
                        <span className="shrink-0 text-zinc-400">{opt.icon}</span>
                      )}

                      <div className="truncate">
                        <span className="block truncate">{opt.label}</span>
                        {opt.subLabel && (
                          <span className="block text-[10px] text-[#71717A] truncate font-mono mt-0.5">
                            {opt.subLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {opt.badge && (
                        <span
                          className={cn(
                            "text-[9px] px-1.5 py-0.2 rounded border font-bold uppercase tracking-wider",
                            getBadgeColor(opt.badge, opt.badgeTone)
                          )}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {!multiple && isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#0D7A5F] shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
