import type React from "react";

const variantColors: Record<string, string> = {
  blue: "var(--vibes-variant-blue)",
  red: "var(--vibes-variant-red)",
  yellow: "var(--vibes-variant-yellow)",
  gray: "var(--vibes-variant-gray)",
};

// Get the appropriate color based on variant
function getVariantColor(variant: string): string {
  return variantColors[variant] || variant;
}

export function getContainerStyle(): React.CSSProperties {
  return {
    position: "relative",
    display: "inline-flex",
    alignItems: "stretch",
    width: "auto",
    marginBottom: "40px",
  };
}

export function getButtonWrapperStyle(): React.CSSProperties {
  return {
    background: "rgba(255, 255, 255, 0.1)",
    border: "2px solid var(--vibes-card-border)",
    borderRadius: "8px",
    padding: "24px 24px 32px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "auto",
  };
}

export function getLabelStyle(
  colorVariant: string,
  isMobile: boolean,
): React.CSSProperties {
  return {
    background: getVariantColor(colorVariant),
    padding: isMobile ? "8px 15px 8px 15px" : "15px 8px 15px 8px",
    borderRadius: isMobile ? "8px 8px 0px 0px" : "0px 8px 8px 0px",
    width: isMobile ? "100%" : "auto",
    fontWeight: 700,
    fontSize: "14px",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
    whiteSpace: "nowrap" as const,
    color: "var(--vibes-card-text)",
    writingMode: isMobile
      ? ("horizontal-tb" as const)
      : ("vertical-rl" as const),
    transform: isMobile ? "none" : "rotate(180deg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

// Media query helpers (use window.matchMedia in component for responsive behavior)
export function getResponsiveLabelStyle(
  isMobile: boolean,
  disappear = false,
): React.CSSProperties {
  if (isMobile) {
    if (disappear) {
      return {
        display: "none",
      };
    }
    // When not disappearing on mobile, show label at top (horizontal)
    return {
      background: "rgba(20, 20, 20, 0.2)",
      border: "2px solid var(--vibes-card-border)",
      borderLeft: "2px solid var(--vibes-card-border)", // Explicitly set to override desktop style
      borderBottom: "none",
      borderTopLeftRadius: "8px",
      borderTopRightRadius: "8px",
      borderBottomRightRadius: "0", // Explicitly reset desktop radius
      padding: "8px 8px 0px 8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      width: "auto",
      margin: "0px 32px",
    };
  }
  // Desktop style - explicitly set all properties
  return {
    background: "rgba(20, 20, 20, 0.2)",
    border: "2px solid var(--vibes-card-border)",
    borderRight: "none",
    borderTopLeftRadius: "8px",
    borderBottomLeftRadius: "8px",
    borderTopRightRadius: "0", // Explicitly set for desktop
    borderBottomRightRadius: "0", // Explicitly set for desktop
    padding: "12px 0px 12px 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    margin: "32px 0px",
    width: "auto", // Explicitly reset from mobile width
  };
}

export function getResponsiveButtonWrapperStyle(
  isMobile: boolean,
  disappear = false,
): React.CSSProperties {
  if (isMobile && disappear) {
    return {
      background: "transparent",
      border: "none",
      borderRadius: "0", // Explicitly reset
      padding: "0",
      paddingBottom: "24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "auto",
    };
  }
  if (isMobile && !disappear) {
    // When not disappearing, keep the card styling but adjust for mobile
    return {
      background: "rgba(20, 20, 20, 0.2)",
      border: "2px solid var(--vibes-card-border)",
      borderRadius: "8px",
      padding: "24px 24px 32px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
    };
  }
  // Desktop style - explicitly set all properties
  return {
    background: "rgba(20, 20, 20, 0.2)",
    border: "2px solid var(--vibes-card-border)",
    borderRadius: "8px",
    padding: "24px 24px 32px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "auto",
  };
}

export function getResponsiveContainerStyle(
  isMobile: boolean,
): React.CSSProperties {
  if (isMobile) {
    return {
      position: "relative",
      display: "inline-flex",
      alignItems: "stretch",
      flexDirection: "column",
      width: "100%",
      marginBottom: "40px",
    };
  }
  // Desktop style - explicitly set all properties
  return {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    flexDirection: "row", // Explicitly set to override mobile column
    width: "auto",
    marginBottom: "40px",
  };
}
