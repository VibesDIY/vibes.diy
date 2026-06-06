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
    gap: isMobile ? 12 : 16,
    padding: isMobile ? 16 : 24,
    maxWidth: 400,
    margin: "0 auto",
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
    padding: isMobile ? "12px 16px" : "16px 24px",
    borderTop: "1px solid rgba(0,0,0,0.12)",
    backgroundColor: "rgb(255, 255, 240)",
    display: "flex",
    flexDirection: "column",
  };
}

export function getTrayLabelStyle(): CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: "0.02em",
  };
}

export function getTrayButtonsStyle(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  };
}

export function getBackButtonStyle(): CSSProperties {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  };
}

export function getAppTitleStyle(): CSSProperties {
  return {
    padding: "14px 16px 4px 56px",
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  };
}
