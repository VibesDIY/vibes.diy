import type React from "react";

// Map variant names to CSS variables that automatically adapt to dark mode
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

// Bounce animation keyframes for icons
export const bounceKeyframes = `
  @keyframes vibes-button-bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }
`;

export function getButtonStyle(
  variant: string,
  isHovered: boolean,
  isActive: boolean,
  isMobile = false,
  hasIcon: boolean,
): React.CSSProperties {
  const cssColor = getVariantColor(variant);
  let transform = "translate(0px, 0px)";
  let boxShadow = `8px 10px 0px 0px ${cssColor}, 8px 10px 0px 2px var(--vibes-button-border)`;

  if (isHovered && !isActive) {
    transform = "translate(2px, 2px)";
    boxShadow = `2px 3px 0px 0px ${cssColor}, 2px 3px 0px 2px var(--vibes-button-border)`;
  }

  if (isActive) {
    transform = "translate(4px, 5px)";
    boxShadow = "none";
  }

  return {
    width: !hasIcon ? "auto" : isMobile ? "100%" : "150px",
    height: !hasIcon ? "auto" : isMobile ? "auto" : "150px",
    minHeight: isMobile ? "60px" : undefined,
    padding: isMobile ? "0.75rem 1.5rem" : "1rem 2rem",
    borderRadius: "12px",
    fontSize: "1rem",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    cursor: "pointer",
    transition: "all 0.15s ease",
    position: "relative" as const,
    transform,
    boxShadow,
  };
}

export function getMergedButtonStyle(
  baseStyle: React.CSSProperties,
  ignoreDarkMode: boolean,
  customStyle?: React.CSSProperties,
): React.CSSProperties {
  return {
    ...baseStyle,
    background: ignoreDarkMode
      ? "var(--vibes-button-bg)"
      : "var(--vibes-button-bg-dark-aware)",
    color: ignoreDarkMode
      ? "var(--vibes-button-text)"
      : "var(--vibes-button-text-dark-aware)",
    border: ignoreDarkMode
      ? "2px solid var(--vibes-button-border)"
      : "2px solid var(--vibes-button-border-dark-aware)",
    ...customStyle,
  };
}

export function getIconContainerStyle(
  variant: string,
  isMobile: boolean,
  hasIcon: boolean,
): React.CSSProperties {
  if (!hasIcon) return {};

  const cssColor = getVariantColor(variant);

  return {
    width: isMobile ? "48px" : "80px",
    height: isMobile ? "48px" : "80px",
    backgroundColor: cssColor,
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    border: "2px solid var(--vibes-black)",
  };
}

export function getIconStyle(
  isMobile: boolean,
  isHovered: boolean,
  isActive: boolean,
): React.CSSProperties {
  return {
    width: isMobile ? "28px" : "50px",
    height: isMobile ? "28px" : "50px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation:
      isHovered && !isActive
        ? "vibes-button-bounce 0.8s ease-in-out infinite"
        : "none",
  };
}

export function getContentWrapperStyle(
  isMobile: boolean,
  hasIcon: boolean,
): React.CSSProperties {
  if (!hasIcon) return {};

  return {
    display: "flex",
    alignItems: "center",
    gap: isMobile ? "16px" : "6px",
    flexDirection: isMobile ? ("row" as const) : ("column" as const),
    justifyContent: isMobile ? ("flex-start" as const) : ("center" as const),
    width: "100%",
  };
}
