"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  MapboxAddressSession,
  mapboxEnabled,
  MIN_QUERY_CHARS,
  SEARCH_DEBOUNCE_MS,
  type MapboxPlace,
  type MapboxSuggestion,
} from "@/lib/geo/mapboxSearch";

/**
 * Plain address text box with Mapbox suggestions. Without a token, or when Mapbox fails,
 * it is just a normal text input. Searches only while typing (never on load).
 */
export default function MapboxAddressInput({
  value,
  onChange,
  onPlaceSelected,
  className,
  placeholder,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: MapboxPlace) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const enabled = mapboxEnabled();
  const sessionRef = useRef<MapboxAddressSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<MapboxSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const session = () => (sessionRef.current ??= new MapboxAddressSession());

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      if (timerRef.current) clearTimeout(timerRef.current);
      sessionRef.current?.abort();
    };
  }, []);

  const search = (q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!enabled || q.trim().length < MIN_QUERY_CHARS) {
      setItems([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const list = await session().suggest(q);
        setItems(list);
        setOpen(list.length > 0);
        setActive(-1);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setItems([]);
          setOpen(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const pick = async (s: MapboxSuggestion) => {
    setOpen(false);
    setActive(-1);
    onChange(s.fullAddress);
    try {
      const place = await session().retrieve(s);
      if (place) {
        onChange(place.fullAddress);
        onPlaceSelected?.(place);
      }
    } catch {
      // keep the suggestion text
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="text"
        value={value}
        required={required}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          search(e.target.value);
        }}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            void pick(items[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && items.length > 0 && (
        <div role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[#EDEDED] bg-white text-xs shadow-xl">
          {items.map((s, i) => (
            <button
              key={s.mapboxId}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => void pick(s)}
              className={`block w-full p-2.5 text-left hover:bg-emerald-50 ${i === active ? "bg-emerald-50" : ""}`}
            >
              <div className="truncate font-bold text-[#18181B]">{s.title}</div>
              <div className="truncate text-[11px] text-[#71717A]">{s.subtitle}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
