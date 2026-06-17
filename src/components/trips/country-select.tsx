"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { COUNTRIES, type Country } from "@/lib/countries";

interface CountrySelectProps {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  id?: string;
}

export function CountrySelect({ value, onChange, placeholder = "Select country", id }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = COUNTRIES.find((c) => c.code === value);
  const filtered = query.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.code.toLowerCase().includes(query.toLowerCase())
      )
    : COUNTRIES;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function pick(country: Country) {
    onChange(country.code);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors min-h-[44px]",
          "border-surface-border bg-surface-overlay text-left",
          open ? "border-accent" : "hover:border-surface-hover",
          !selected && "text-text-placeholder"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selected ? `${selected.code} — ${selected.name}` : placeholder}</span>
        {selected ? (
          <X
            className="h-4 w-4 shrink-0 text-text-muted hover:text-text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            aria-label="Clear"
          />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-surface-border bg-surface-elevated shadow-modal">
          <div className="flex items-center gap-2 border-b border-surface-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries…"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-placeholder outline-none"
            />
          </div>
          <ul
            role="listbox"
            className="max-h-56 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-text-muted">No countries found</li>
            ) : (
              filtered.map((country) => (
                <li
                  key={country.code}
                  role="option"
                  aria-selected={country.code === value}
                  onClick={() => pick(country)}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer px-3 py-2 text-sm transition-colors",
                    country.code === value
                      ? "bg-accent-subtle text-accent"
                      : "text-text-primary hover:bg-surface-hover"
                  )}
                >
                  <span className="w-8 shrink-0 font-mono text-xs text-text-muted">{country.code}</span>
                  <span>{country.name}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
