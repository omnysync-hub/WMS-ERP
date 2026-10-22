"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  allowCustom?: boolean;
}

export default function SearchableCombobox({
  value,
  onChange,
  options = [],
  placeholder = "Type or select...",
  className,
  inputClassName,
  disabled = false,
  required = false,
  name,
  id,
  allowCustom = true,
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter options:
  // If not actively typing or if current value is an exact option match, show ALL preset options
  // so the user can easily see and switch to any other configured option!
  const filteredOptions = useMemo(() => {
    if (!isTyping || !value || !value.trim()) return options;

    const isExactMatch = options.some(
      (opt) => opt.toLowerCase().trim() === value.toLowerCase().trim()
    );
    if (isExactMatch) return options;

    const q = value.toLowerCase().trim();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, value, isTyping]);

  // Handle outside click to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsTyping(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Set highlighted index to selected item when opened so it scrolls into view
  useEffect(() => {
    if (isOpen && value && value.trim()) {
      const idx = filteredOptions.findIndex(
        (opt) => opt.toLowerCase().trim() === value.toLowerCase().trim()
      );
      if (idx >= 0) {
        scrollHighlightRef.current = true;
        setHighlightedIndex(idx);
      }
    }
  }, [isOpen]);

  // Keep the highlighted item visible when moving with the arrow keys. Only the list itself is
  // scrolled (never the page), and hovering with the mouse never scrolls: scrolling under the
  // cursor used to move a different option under it, so clicks landed on the wrong option.
  const scrollHighlightRef = useRef(false);
  useEffect(() => {
    if (!scrollHighlightRef.current) return;
    scrollHighlightRef.current = false;
    const list = listRef.current;
    if (highlightedIndex < 0 || !list) return;
    const item = list.querySelectorAll("[data-combobox-item]")[highlightedIndex] as HTMLElement | undefined;
    if (!item) return;
    // The scrolling box is the list itself or its nearest scrollable parent inside the dropdown.
    let box: HTMLElement = list;
    while (box.parentElement && box.scrollHeight <= box.clientHeight && box !== containerRef.current) box = box.parentElement;
    const listBox = box.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    if (itemBox.top < listBox.top) box.scrollTop -= listBox.top - itemBox.top;
    else if (itemBox.bottom > listBox.bottom) box.scrollTop += itemBox.bottom - listBox.bottom;
  }, [highlightedIndex]);

  const handleSelectOption = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
    setIsTyping(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsTyping(false);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setIsTyping(false);
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        scrollHighlightRef.current = true;
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        scrollHighlightRef.current = true;
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelectOption(filteredOptions[highlightedIndex]);
        } else {
          setIsOpen(false);
          setIsTyping(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setIsTyping(false);
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full text-xs", className)}
    >
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          value={value}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setIsTyping(true);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            setIsOpen(true);
            setIsTyping(false);
          }}
          onClick={() => {
            if (!isOpen) {
              setIsOpen(true);
              setIsTyping(false);
            }
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={cn(
            "w-full bg-white px-3 py-2 pr-14 rounded-lg border border-[#EDEDED] text-[#18181B] font-medium placeholder-[#A1A1AA] transition",
            "focus:outline-none focus:border-[#0D7A5F] focus:ring-1 focus:ring-[#0D7A5F]",
            disabled && "bg-[#F4F4F5] text-[#A1A1AA] cursor-not-allowed",
            isOpen && "border-[#0D7A5F] ring-1 ring-[#0D7A5F]",
            inputClassName
          )}
        />

        <div className="absolute right-1.5 flex items-center gap-0.5">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-[#A1A1AA] hover:text-[#18181B] rounded-md transition"
              title="Clear input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsOpen((prev) => {
                const next = !prev;
                if (next) {
                  setIsTyping(false);
                  inputRef.current?.focus();
                }
                return next;
              });
            }}
            className="p-1 text-[#71717A] hover:text-[#18181B] rounded-md transition cursor-pointer"
            title="Toggle options"
          >
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-200",
                isOpen && "rotate-180 text-[#0D7A5F]"
              )}
            />
          </button>
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-[#E4E4E7] rounded-xl shadow-lg animate-in fade-in-50 zoom-in-95">
          <div ref={listRef} className="p-1 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-[#71717A] text-[11px] space-y-1">
                <p>No exact match in presets</p>
                {allowCustom && value.trim() && (
                  <p className="font-semibold text-[#0D7A5F]">
                    Using custom value: &quot;{value}&quot;
                  </p>
                )}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.toLowerCase() === value.toLowerCase();
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={`${opt}-${idx}`}
                    type="button"
                    data-combobox-item
                    onClick={() => handleSelectOption(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition",
                      isSelected
                        ? "bg-emerald-50 text-[#0D7A5F] font-semibold"
                        : isHighlighted
                        ? "bg-[#F4F4F5] text-[#18181B]"
                        : "text-[#18181B] hover:bg-[#F9FAFB]"
                    )}
                  >
                    <span className="truncate pr-2">{opt}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#0D7A5F] shrink-0" />
                    )}
                  </button>
                );
              })
            )}

            {allowCustom && value.trim() && !options.some((o) => o.toLowerCase() === value.toLowerCase().trim()) && (
              <div className="pt-1 mt-1 border-t border-[#F4F4F5]">
                <div className="px-2.5 py-1 text-[11px] text-emerald-800 bg-emerald-50/60 rounded-md flex items-center justify-between">
                  <span>Custom Entry</span>
                  <span className="font-mono text-[10px] bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded">
                    Active
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
