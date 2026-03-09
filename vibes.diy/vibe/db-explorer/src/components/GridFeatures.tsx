import { useState, useRef, useEffect } from "react";
import { S } from "../lib/styles.js";

export interface GridOptions {
  columnResizing: boolean;
  columnHover: boolean;
  floatingFilters: boolean;
  pagination: boolean;
  rowDrag: boolean;
  rowNumbers: boolean;
  rowSelection: boolean;
}

export const defaultGridOptions: GridOptions = {
  columnResizing: true,
  columnHover: false,
  floatingFilters: false,
  pagination: true,
  rowDrag: false,
  rowNumbers: false,
  rowSelection: false,
};

const labels: Record<keyof GridOptions, string> = {
  columnResizing: "Column Resizing",
  columnHover: "Column Hover",
  floatingFilters: "Floating Filters",
  pagination: "Pagination",
  rowDrag: "Row Drag",
  rowNumbers: "Row Numbers",
  rowSelection: "Row Selection",
};

const optionOrder: (keyof GridOptions)[] = [
  "columnHover",
  "columnResizing",
  "floatingFilters",
  "pagination",
  "rowDrag",
  "rowNumbers",
  "rowSelection",
];

interface GridFeaturesProps {
  options: GridOptions;
  onChange: (options: GridOptions) => void;
}

export function GridFeatures({ options, onChange }: GridFeaturesProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: open ? S.bgDeep : "transparent",
          border: `1px solid ${open ? S.accent + "60" : S.border}`,
          color: open ? S.accent : S.textDim,
          borderRadius: 4,
          padding: "4px 10px",
          fontSize: 11,
          cursor: "pointer",
          fontFamily: S.mono,
          fontWeight: 500,
          transition: "all 0.12s",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Grid Features
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 100,
            background: S.bgSurface,
            border: `1px solid ${S.border}`,
            borderRadius: 6,
            padding: "8px 0",
            minWidth: 220,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
        >
          {optionOrder.map((key) => (
            <label
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 16px",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: S.sans,
                color: options[key] ? S.text : S.textDim,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = S.bgHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <input
                type="checkbox"
                checked={options[key]}
                onChange={() => onChange({ ...options, [key]: !options[key] })}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: S.accent,
                  cursor: "pointer",
                  margin: 0,
                }}
              />
              {labels[key]}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
