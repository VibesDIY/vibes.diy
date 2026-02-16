import { CSSProperties } from "react";

export type BrutalistCardVariant = "default" | "success" | "error" | "warning";
export type BrutalistCardSize = "sm" | "md" | "lg";

export const BrutalistCardStyles = {
  /**
   * Get shadow color based on variant
   */
  getShadowColor(variant: BrutalistCardVariant): string {
    switch (variant) {
      case "success":
        return "var(--vibes-green)"; // Green
      case "error":
        return "var(--vibes-red-accent)"; // Red
      case "warning":
        return "var(--vibes-yellow-accent)"; // Yellow
      case "default":
      default:
        return "var(--vibes-shadow-color)"; // Dark gray (theme-aware)
    }
  },

  /**
   * Get padding based on size
   */
  getPadding(size: BrutalistCardSize): string {
    switch (size) {
      case "sm":
        return "0.75rem 1rem";
      case "md":
        return "1rem";
      case "lg":
        return "2rem 3rem";
      default:
        return "1rem";
    }
  },

  /**
   * Get font size based on size
   */
  getFontSize(size: BrutalistCardSize): string {
    switch (size) {
      case "sm":
        return "0.875rem";
      case "md":
        return "1rem";
      case "lg":
        return "1rem";
      default:
        return "1rem";
    }
  },

  /**
   * Get box shadow based on size and variant
   */
  getBoxShadow(size: BrutalistCardSize, variant: BrutalistCardVariant): string {
    const color = this.getShadowColor(variant);

    switch (size) {
      case "sm":
        return `2px 3px 0px 0px ${color}`;
      case "md":
        return `4px 5px 0px 0px ${color}`;
      case "lg":
        return `6px 6px 0px 0px ${color}`;
      default:
        return `4px 5px 0px 0px ${color}`;
    }
  },

  /**
   * Get border radius based on message type
   */
  getBorderRadius(messageType?: "user" | "ai"): string {
    switch (messageType) {
      case "user":
        return "12px 12px 0 12px"; // Bottom-right not rounded
      case "ai":
        return "12px 12px 12px 0"; // Bottom-left not rounded
      default:
        return "12px"; // All corners rounded
    }
  },

  /**
   * Get the brutalist card style
   */
  getCardStyle(
    variant: BrutalistCardVariant = "default",
    size: BrutalistCardSize = "md",
    messageType?: "user" | "ai"
  ): CSSProperties {
    return {
      // background, color, and border are now controlled by CSS classes for dark mode support
      borderRadius: this.getBorderRadius(messageType),
      padding: this.getPadding(size),
      fontSize: this.getFontSize(size),
      fontWeight: 500,
      letterSpacing: "0.02em",
      boxShadow: this.getBoxShadow(size, variant),
      transition: "box-shadow 0.15s ease, transform 0.15s ease",
      boxSizing: "border-box" as const,
    };
  },
};
