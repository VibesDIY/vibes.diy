import { CSSProperties } from "react";

export type VibesButtonVariant = "blue" | "red" | "yellow" | "gray" | string;

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

export const VibesButtonStyles = {
  /**
   * Map variant names to CSS variables that automatically adapt to dark mode
   */
  variantColors: {
    blue: "var(--vibes-variant-blue)",
    red: "var(--vibes-variant-red)",
    yellow: "var(--vibes-variant-yellow)",
    gray: "var(--vibes-variant-gray)",
  } as Record<string, string>,

  /**
   * Get the appropriate color based on variant
   */
  getVariantColor(variant: string): string {
    return this.variantColors[variant] || variant;
  },

  /**
   * Get button transform based on interaction state
   */
  getTransform(isHovered: boolean, isActive: boolean): string {
    if (isActive) {
      return "translate(4px, 5px)";
    }
    if (isHovered) {
      return "translate(2px, 2px)";
    }
    return "translate(0px, 0px)";
  },

  /**
   * Get box shadow based on variant and interaction state
   */
  getBoxShadow(variant: string, isHovered: boolean, isActive: boolean): string {
    if (isActive) {
      return "none";
    }
    const cssColor = this.getVariantColor(variant);
    if (isHovered) {
      return `2px 3px 0px 0px ${cssColor}, 2px 3px 0px 2px var(--vibes-button-border)`;
    }
    return `8px 10px 0px 0px ${cssColor}, 8px 10px 0px 2px var(--vibes-button-border)`;
  },

  /**
   * Get button dimensions based on context
   */
  getDimensions(isMobile: boolean, hasIcon: boolean): { width: string; height?: string; minHeight?: string } {
    if (!hasIcon) {
      return { width: "auto" };
    }
    if (isMobile) {
      return { width: "100%", minHeight: "60px" };
    }
    return { width: "150px", height: "150px" };
  },

  /**
   * Get padding based on mobile state
   */
  getPadding(isMobile: boolean): string {
    return isMobile ? "0.75rem 1.5rem" : "1rem 2rem";
  },

  /**
   * Get the button style
   */
  getButtonStyle(variant: string, isHovered: boolean, isActive: boolean, isMobile = false, hasIcon: boolean): CSSProperties {
    return {
      ...this.getDimensions(isMobile, hasIcon),
      padding: this.getPadding(isMobile),
      borderRadius: "12px",
      fontSize: "1rem",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "0.05em",
      cursor: "pointer",
      transition: "all 0.15s ease",
      position: "relative" as const,
      transform: this.getTransform(isHovered, isActive),
      boxShadow: this.getBoxShadow(variant, isHovered, isActive),
    };
  },

  /**
   * Merge button style with background/color/border that respect dark mode settings
   */
  getMergedButtonStyle(baseStyle: CSSProperties, ignoreDarkMode: boolean, customStyle?: CSSProperties): CSSProperties {
    return {
      ...baseStyle,
      background: ignoreDarkMode ? "var(--vibes-button-bg)" : "var(--vibes-button-bg-dark-aware)",
      color: ignoreDarkMode ? "var(--vibes-button-text)" : "var(--vibes-button-text-dark-aware)",
      border: ignoreDarkMode ? "2px solid var(--vibes-button-border)" : "2px solid var(--vibes-button-border-dark-aware)",
      ...customStyle,
    };
  },

  /**
   * Get icon container style
   */
  getIconContainerStyle(variant: string, isMobile: boolean, hasIcon: boolean): CSSProperties {
    if (!hasIcon) return {};

    const cssColor = this.getVariantColor(variant);

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
  },

  /**
   * Get icon style with animation
   */
  getIconStyle(isMobile: boolean, isHovered: boolean, isActive: boolean): CSSProperties {
    return {
      width: isMobile ? "28px" : "50px",
      height: isMobile ? "28px" : "50px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      animation: isHovered && !isActive ? "vibes-button-bounce 0.8s ease-in-out infinite" : "none",
    };
  },

  /**
   * Get content wrapper style
   */
  getContentWrapperStyle(isMobile: boolean, hasIcon: boolean): CSSProperties {
    if (!hasIcon) return {};

    return {
      display: "flex",
      alignItems: "center",
      gap: isMobile ? "16px" : "6px",
      flexDirection: isMobile ? ("row" as const) : ("column" as const),
      justifyContent: isMobile ? ("flex-start" as const) : ("center" as const),
      width: "100%",
    };
  },
};
