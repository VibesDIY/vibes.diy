import React from "react";

export interface ColorThemeTokens {
  background?: string;
  surface?: string;
  primary?: string;
  accent?: string;
  "text-primary"?: string;
  border?: string;
  "font-family"?: string;
  radius?: string;
}

const NEUTRAL: Required<
  Pick<ColorThemeTokens, "background" | "surface" | "accent" | "text-primary" | "border" | "radius">
> = {
  background: "#0d0d10",
  surface: "#17171c",
  accent: "#6b7280",
  "text-primary": "#e5e7eb",
  border: "rgba(255,255,255,0.10)",
  radius: "0.5rem",
};

/**
 * Parametric themed cold-open placeholder: an app shell (header, two cards, a
 * CTA) painted from the pre-allocated theme tokens before any app code exists.
 * Scales across all themes with no per-theme work; replaced by the real app
 * iframe on first paint. Static (no motion) by scope.
 */
export function ThemedSkeleton({ colorTheme }: { colorTheme: ColorThemeTokens | null }): JSX.Element {
  const t = colorTheme ?? {};
  const vars = {
    "--skeleton-bg": t.background ?? NEUTRAL.background,
    "--skeleton-surface": t.surface ?? NEUTRAL.surface,
    "--skeleton-accent": t.accent ?? t.primary ?? NEUTRAL.accent,
    "--skeleton-text": t["text-primary"] ?? NEUTRAL["text-primary"],
    "--skeleton-border": t.border ?? NEUTRAL.border,
    "--skeleton-radius": t.radius ?? NEUTRAL.radius,
    "--skeleton-font": t["font-family"] ?? "system-ui, sans-serif",
  } as React.CSSProperties;
  return (
    <div
      data-testid="themed-skeleton"
      aria-hidden="true"
      style={{
        ...vars,
        position: "absolute",
        inset: 0,
        background: "var(--skeleton-bg)",
        color: "var(--skeleton-text)",
        fontFamily: "var(--skeleton-font)",
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div
        data-testid="themed-skeleton-header"
        style={{ height: 44, borderRadius: "var(--skeleton-radius)", background: "var(--skeleton-accent)", opacity: 0.85 }}
      />
      <div style={{ display: "flex", gap: "1rem" }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            data-testid={`themed-skeleton-card-${i}`}
            style={{
              flex: 1,
              height: 140,
              borderRadius: "var(--skeleton-radius)",
              background: "var(--skeleton-surface)",
              border: "1px solid var(--skeleton-border)",
            }}
          />
        ))}
      </div>
      <div
        data-testid="themed-skeleton-cta"
        style={{ height: 40, width: 160, borderRadius: "var(--skeleton-radius)", background: "var(--skeleton-accent)" }}
      />
    </div>
  );
}
