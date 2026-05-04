/**
 * Theme Picker Modal
 *
 * Users can import custom themes using the DESIGN.md format
 * (https://github.com/google-labs-code/design.md).
 *
 * Community DESIGN.md collections:
 * - https://github.com/VoltAgent/awesome-design-md — brand-inspired design systems (Stripe, Spotify, etc.)
 * - https://github.com/VoltAgent/awesome-claude-design — 68 ready-to-use design systems
 * - https://github.com/google-labs-code/design.md/tree/main/examples — official examples
 */
import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { VibesTheme } from "@vibes.diy/prompts";
import { parseDesignMd } from "@vibes.diy/prompts";

interface ThemePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (theme: VibesTheme) => void;
  selectedSlug?: string;
  themes: VibesTheme[];
}

export default function ThemePickerModal({ open, onClose, onSelect, selectedSlug, themes }: ThemePickerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const theme = parseDesignMd(content, file.name.replace(/\.md$/i, "").toLowerCase());
      onSelect(theme);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [onSelect]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }} />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          backgroundColor: "#fff",
          borderRadius: 8,
          border: "2px solid #1a1a1a",
          boxShadow: "6px 6px 0px 0px #1a1a1a",
          maxWidth: 860,
          width: "calc(100% - 32px)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "2px solid #1a1a1a" }}>
          <span style={{ fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Choose a Theme</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "none",
                border: "1px solid #d4d4d8",
                borderRadius: 4,
                cursor: "pointer",
                padding: "4px 8px",
                fontSize: "0.7rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#6b6b80",
              }}
              aria-label="Import DESIGN.md"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              Import .md
            </button>
            <input ref={fileInputRef} type="file" accept=".md" onChange={handleFileImport} style={{ display: "none" }} />
            <button
              type="button"
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 1 }}
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Grid */}
        <div style={{ overflowY: "auto", padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {themes.map((theme) => {
              const isSelected = theme.slug === selectedSlug;
              return (
                <button
                  key={theme.slug}
                  type="button"
                  onClick={() => onSelect(theme)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    border: isSelected ? "3px solid #3b82f6" : "2px solid #d4d4d8",
                    borderRadius: 6,
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "#fff",
                    padding: 0,
                    transition: "border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease",
                    boxShadow: isSelected ? "3px 3px 0px 0px #3b82f6" : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = "translate(-1px, -1px)";
                      e.currentTarget.style.boxShadow = "2px 2px 0px 0px #1a1a1a";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.boxShadow = "none";
                    }
                  }}
                >
                  {/* Theme preview iframe */}
                  <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10", overflow: "hidden", backgroundColor: theme.bgColor }}>
                    <iframe
                      src={`/themes/${theme.slug}.html`}
                      title={theme.name}
                      sandbox="allow-same-origin"
                      loading="lazy"
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        width: 1400,
                        height: 900,
                        transform: "translate(-50%, -50%) scale(0.18)",
                        border: "none",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                  {/* Name + accent swatch */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 10px",
                    borderTop: "1px solid #e5e5e5",
                  }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, backgroundColor: theme.accentColor }} />
                    <span style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "#1a1a1a",
                    }}>
                      {theme.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
