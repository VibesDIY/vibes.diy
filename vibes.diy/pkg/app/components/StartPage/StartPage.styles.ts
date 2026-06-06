import type { CSSProperties } from "react";

export function getPageStyle(): CSSProperties {
  return {
    minHeight: "100dvh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
  };
}

export function getCategoryGridStyle(isMobile: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: isMobile ? 16 : 24,
    padding: isMobile ? "24px" : "48px",
    maxWidth: 400,
    margin: "0 auto",
    flex: 1,
    alignContent: "center",
  };
}

export function getAppContainerStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
  };
}

export function getAppBodyStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    position: "relative",
  };
}

export function getTrayStyle(isMobile: boolean): CSSProperties {
  return {
    flexShrink: 0,
    padding: isMobile ? "12px 16px 24px" : "16px 24px 32px",
    borderTop: "2px solid var(--vibes-near-black)",
    backgroundColor: "var(--vibes-cream, #FFFEF0)",
    display: "flex",
    flexDirection: "column",
    gap: isMobile ? 10 : 12,
  };
}

export function getTrayLabelStyle(): CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: "0.02em",
    color: "var(--vibes-near-black)",
  };
}

export function getTrayButtonsStyle(): CSSProperties {
  return {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  };
}

export function getBackButtonStyle(): CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "2px solid var(--vibes-near-black)",
    backgroundColor: "var(--vibes-cream, #FFFEF0)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 800,
    color: "var(--vibes-near-black)",
    flexShrink: 0,
  };
}

export function getAppTitleStyle(): CSSProperties {
  return {
    padding: "14px 16px 4px 56px",
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    color: "var(--vibes-near-black)",
  };
}
