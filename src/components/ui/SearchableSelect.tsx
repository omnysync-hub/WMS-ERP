"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
  icon?: React.ReactNode;
  badge?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  options: (string | SelectOption)[];
  value?: string;
  onChange: (value: string) => void;
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
}

export default function SearchableSelect({
  options,
  value,
  onChange,
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

  // Selected option lookup
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => opt.value === value);
  }, [normalizedOptions, value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const query = searchTerm.toLowerCase().trim();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(query)) ||
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
            onChange(opt.value);
            setIsOpen(false);
          }
        } else if (filteredOptions.length === 1 && !filteredOptions[0].disabled) {
          onChange(filteredOptions[0].value);
          setIsOpen(false);
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
    onChange(opt.value);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

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
          value={value || ""}
          required={required}
        />
      )}

      {/* Main Trigger Button */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={cn(
          "w-full min-h-[36px] px-3 py-1.5 text-xs bg-[#F4F4F5] border border-[#E4E4E7] rounded-lg text-[#18181B] flex items-center justify-between gap-2 cursor-pointer transition focus:bg-white focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F] focus:outline-none hover:border-[#D4D4D8]",
          isOpen && "bg-white border-[#0D7A5F] ring-1 ring-[#0D7A5F]",
          disabled && "opacity-50 cursor-not-allowed bg-zinc-100",
          className
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          {icon && <span className="text-[#71717A] shrink-0">{icon}</span>}
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              {selectedOption.icon && (
                <span className="shrink-0">{selectedOption.icon}</span>
              )}
              <span className="font-semibold truncate">{selectedOption.label}</span>
              {selectedOption.subLabel && (
                <span className="text-[10px] text-[#71717A] truncate font-mono">
                  ({selectedOption.subLabel})
                </span>
              )}
              {selectedOption.badge && (
                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700">
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[#A1A1AA] truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-[#71717A]">
          {clearable && selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 transition"
              title="Clear selection"
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
          <div className="p-2 border-b border-[#E4E4E7] bg-[#FAFAFA] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#71717A] shrink-0 ml-1" />
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

          {/* Options List */}
          <div
            ref={listRef}
            role="listbox"
            className="max-h-60 overflow-y-auto p-1.5 space-y-0.5"
          >
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#71717A]">
                <p className="font-semibold text-[#18181B]">No matches found</p>
                <p className="text-[11px] mt-0.5">Try a different search term</p>
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
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
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
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
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
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
