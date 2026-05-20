import React from "react";

interface VibesSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

export function VibesSearchBar({ value, onChange, placeholder = "Search…", ariaLabel = "Search" }: VibesSearchBarProps) {
  return (
    <div className="relative w-full max-w-md">
      <span
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-light-primary/50 dark:text-dark-primary/50 pointer-events-none"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full h-9 pl-9 pr-9 rounded-full bg-white dark:bg-dark-background-01 border-2 border-[var(--vibes-near-black)] dark:border-[var(--color-dark-decorative-01)] text-light-primary dark:text-dark-primary text-sm placeholder:text-light-primary/50 dark:placeholder:text-dark-primary/50 focus:outline-none focus:ring-2 focus:ring-[var(--vibes-blue,#3b82f6)]/50"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-light-primary dark:text-dark-primary"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
